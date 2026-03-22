import { useState, useRef, useEffect, useCallback } from 'react'
import { useAuthStore } from '../../store/authStore'
import { useStreamStore } from '../../store/streamStore'
import { useMessageStore } from '../../store/messageStore'
import { useWebSocket } from '../../hooks/useWebSocket'
import { useMediaRecorder } from '../../hooks/useMediaRecorder'
import { toast } from '../../store/toastStore'
import { messagesApi } from '../../api/messages'
import { streamApi } from '../../api/stream'
import styles from './PlayerPage.module.css'
import { AudioVisualizer } from '../../components/player/AudioVisualizer'

// Если VITE_STREAM_URL пустой — используем /stream (nginx проксирует на Icecast)
const _envStream = import.meta.env.VITE_STREAM_URL as string | undefined
const STREAM_URL = (_envStream && _envStream.trim()) ? _envStream.trim()
  : (import.meta.env.VITE_USE_MOCKS === 'true' ? null : '/stream')

export function PlayerPage() {
  const { user, token } = useAuthStore()
  const { isLive, isVideo, currentTrack, volume, setVolume } = useStreamStore()
  const { addMessage } = useMessageStore()
  const [sending, setSending] = useState(false)
  const [streamUrl, setStreamUrl] = useState<string | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wasPlayingRef  = useRef(false)
  const { listeners } = useWebSocket(token)
  const recorder = useMediaRecorder()

  /* Player state */
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress]   = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const mediaSourceRef = useRef<MediaSource | null>(null)
  const sourceBufferRef = useRef<SourceBuffer | null>(null)
  const videoWsRef = useRef<WebSocket | null>(null)
  const pendingChunks = useRef<ArrayBuffer[]>([])

  /* Message form */
  const [msgText, setMsgText] = useState('')
  const [msgSent, setMsgSent] = useState(false)

  /* Fetch stream URL + health check */
  const [streamAlive, setStreamAlive] = useState<boolean | null>(null)

  useEffect(() => {
    // Fetch stream URL
    streamApi.getStreamUrl().then(({ url }) => {
      if (url) setStreamUrl(url)
    }).catch(() => {})

    // Fetch current stream state (isLive, isVideo) immediately on mount
    // so the player shows correct state even before WebSocket connects
    streamApi.getState().then(state => {
      const { setLive, setVideo, setTrack } = useStreamStore.getState()
      setLive(state.isLive)
      setVideo(state.isVideo)
      setTrack(state.currentTrack)
    }).catch(() => {})

    // Check Icecast health periodically
    const checkHealth = () => {
      fetch('/api/stream/health')
        .then(r => r.json())
        .then(d => setStreamAlive(d.alive))
        .catch(() => setStreamAlive(false))
    }
    checkHealth()
    const id = setInterval(checkHealth, 30000)
    return () => clearInterval(id)
  }, [])

  /* Init audio element */
  useEffect(() => {
    const a = new Audio()
    a.preload = 'none'
    a.volume  = volume / 100

    a.onplaying = () => { wasPlayingRef.current = true }

    a.onerror = () => {
      // Ignore errors if src was intentionally cleared (e.g. on unmount or pause)
      if (!a.src || a.src === window.location.href) return
      if (wasPlayingRef.current) {
        toast.warning('Поток прерван — переподключение через 5 сек...')
        setIsPlaying(false)
        wasPlayingRef.current = false
        if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
        reconnectTimer.current = setTimeout(() => {
          const base = a.src.split('?')[0]
          if (base && base !== window.location.href) {
            a.src = base + '?t=' + Date.now()
            a.load()
            a.play().catch(() => {})
          }
        }, 5000)
      }
      // If not playing — silent fail, user will press play again
    }

    // stalled = browser stopped buffering; just wait, don't reconnect aggressively
    a.addEventListener('stalled', () => {
      // No action — onerror will handle real failures
    })

    // ended = stream source disconnected cleanly
    a.addEventListener('ended', () => {
      if (!wasPlayingRef.current) return
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
      reconnectTimer.current = setTimeout(() => {
        const base = a.src.split('?')[0]
        if (base && base !== window.location.href) {
          a.src = base + '?t=' + Date.now()
          a.load()
          a.play().catch(() => {})
        }
      }, 3000)
    })

    audioRef.current = a
    setAudioEl(a)
    return () => {
      a.pause()
      a.src = ''
      wasPlayingRef.current = false
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
    }
  }, [])

  /* Volume sync */
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume / 100
    if (videoRef.current) videoRef.current.volume = volume / 100
  }, [volume])

  /* Connect to video WebSocket when host starts video broadcast */
  useEffect(() => {
    if (!isVideo) {
      videoWsRef.current?.close()
      videoWsRef.current = null
      pendingChunks.current = []
      sourceBufferRef.current = null
      if (videoRef.current) {
        videoRef.current.src = ''
        videoRef.current.load()
      }
      return
    }

    const ms = new MediaSource()
    mediaSourceRef.current = ms
    videoRef.current.src = URL.createObjectURL(ms)

    ms.addEventListener('sourceopen', () => {
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : 'video/webm'
      try {
        const sb = ms.addSourceBuffer(mimeType)
        sourceBufferRef.current = sb
        sb.addEventListener('updateend', () => {
          if (pendingChunks.current.length > 0 && !sb.updating) {
            sb.appendBuffer(pendingChunks.current.shift()!)
          }
        })
        // Flush any chunks that arrived before sourceopen
        if (pendingChunks.current.length > 0 && !sb.updating) {
          sb.appendBuffer(pendingChunks.current.shift()!)
        }
      } catch (e) {
        console.warn('SourceBuffer error:', e)
      }
    })

    const wsBase = (import.meta.env.VITE_WS_URL as string) || `ws://${location.host}`
    const watchUrl = wsBase.replace('/ws', '') + '/ws/video/watch'
    const ws = new WebSocket(watchUrl)
    ws.binaryType = 'arraybuffer'
    videoWsRef.current = ws

    ws.onmessage = (e) => {
      const chunk = e.data as ArrayBuffer
      const sb = sourceBufferRef.current
      if (!sb) {
        pendingChunks.current.push(chunk)
        return
      }
      if (sb.updating) {
        pendingChunks.current.push(chunk)
      } else {
        try { sb.appendBuffer(chunk) } catch {}
      }
      // Auto-play
      if (videoRef.current && videoRef.current.paused && videoRef.current.readyState >= 2) {
        videoRef.current.play().catch(() => {})
      }
    }

    ws.onerror = () => toast.warning('Видеопоток недоступен')

    return () => {
      ws.close()
      videoWsRef.current = null
      pendingChunks.current = []
      sourceBufferRef.current = null
    }
  }, [isVideo]) // eslint-disable-line react-hooks/exhaustive-deps

  /* Stop playing if stream goes offline */
  useEffect(() => {
    if (!isLive && isPlaying) {
      audioRef.current?.pause()
      if (videoRef.current) videoRef.current.pause()
      setIsPlaying(false)
      toast.warning('Эфир завершён')
    }
  }, [isLive])

  /* Fake progress for mock mode */
  useEffect(() => {
    if (!isPlaying || streamUrl || STREAM_URL) return
    const id = setInterval(() => setProgress(p => (p >= 100 ? 0 : p + 0.15)), 200)
    return () => clearInterval(id)
  }, [isPlaying])

  const togglePlay = useCallback(async () => {
    if (!isLive) { toast.warning('Эфир сейчас не активен'); return }

    if (isPlaying) {
      audioRef.current?.pause()
      setIsPlaying(false)
      return
    }

    const url = streamUrl || STREAM_URL
    if (!url) {
      toast.error('Адрес потока недоступен')
      return
    }
    if (audioRef.current) {
      const audio = audioRef.current
      // Fresh URL with cache-buster every time
      audio.src = url + '?t=' + Date.now()
      audio.load()
      try {
        await audio.play()
        wasPlayingRef.current = true
      } catch (err: any) {
        if (err?.name === 'NotAllowedError') {
          toast.info('Нажмите ещё раз для воспроизведения')
        } else {
          // Stream not ready yet — show friendly message, don't mark as playing
          toast.warning('Поток ещё не готов — попробуйте через несколько секунд')
          return
        }
      }
    }
    setIsPlaying(true)
  }, [isLive, isPlaying, isVideo])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!msgText.trim() && !recorder.blob) return
    setSending(true)
    try {
      const msg = await messagesApi.send(msgText.trim(), recorder.blob)
      // Also update local store for instant UI feedback
      addMessage({ senderId: user!.id, senderLogin: user!.login, content: msgText.trim() })
      setMsgText('')
      recorder.clear()
      setMsgSent(true)
      toast.success('Сообщение отправлено ведущему')
      setTimeout(() => setMsgSent(false), 3000)
    } catch {
      // toast already shown by axios interceptor
    } finally {
      setSending(false)
    }
  }

  return (
    <div className={`${styles.page} page-enter`}>
      <div className={styles.container}>

        {/* Status bar */}
        <div className={styles.statusBar}>
          <div className={styles.onAir} data-live={isLive}>
            <span className={styles.onAirDot} />
            {isLive ? 'В ЭФИРЕ' : 'ЭФИР НЕ АКТИВЕН'}
          {streamAlive === false && isLive && (
            <span className={styles.streamError}>нет сигнала</span>
          )}
          </div>
          <div className={styles.listeners}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <circle cx="6" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M2 13c0-2.2 1.8-4 4-4s4 1.8 4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              <circle cx="11.5" cy="4.5" r="2" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M13 13c0-1.7-1-3-2.5-3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            <span>{listeners} слушател{listeners === 1 ? 'ь' : listeners >= 2 && listeners <= 4 ? 'я' : 'ей'} онлайн</span>
          </div>
        </div>

        {/* ── VIDEO player (receives stream via WebSocket MediaSource) ── */}
        <div className={styles.videoWrap} style={{ display: isVideo ? 'block' : 'none' }}>
          <video
            ref={videoRef}
            className={styles.videoEl}
            playsInline
            autoPlay
            muted={false}
          />
          <div className={styles.videoBadge}>
            <span className={styles.videoDot} />ВИДЕО ЭФИР
          </div>
        </div>

        {/* ── AUDIO player ─────────────────────────────── */}
        <div className={styles.playerCard} data-video={isVideo}>
          {!isVideo && (
            <div className={styles.albumArt} data-playing={isPlaying}>
              <svg width="42" height="42" viewBox="0 0 48 48" fill="none">
                <circle cx="24" cy="24" r="21" stroke="rgba(255,255,255,0.12)" strokeWidth="2"/>
                <circle cx="24" cy="24" r="8" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5"/>
                <polygon points="20,17.5 32,24 20,30.5" fill="rgba(255,255,255,0.55)"/>
              </svg>
            </div>
          )}

          <div className={styles.trackInfo}>
            <span className={styles.trackLabel}>ТРАНСТЕЛЕКОМ — КОРПОРАТИВНОЕ РАДИО</span>
            <span className={styles.trackName}>
              {currentTrack || (isLive ? 'Прямой эфир' : 'Ожидание трансляции...')}
            </span>
          </div>

          {/* Audio Visualizer */}
          {!isVideo && (
            <AudioVisualizer
              audioEl={audioEl}
              isPlaying={isPlaying}
              height={52}
            />
          )}

          {/* Progress bar (audio mode only) */}
          {!isVideo && (
            <div className={styles.progressWrap}>
              <div className={styles.progressBg}>
                <div className={styles.progressFill} style={{ width: `${progress}%` }} />
                <div className={styles.progressThumb} style={{ left: `${progress}%` }} />
              </div>
            </div>
          )}

          {/* Controls */}
          <div className={styles.controls}>
            {!isVideo && (
              <>
                <button className={styles.ctrlBtn} title="Предыдущий" disabled>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <polygon points="12,3 4,8 12,13" fill="currentColor"/>
                    <rect x="3" y="3" width="2" height="10" rx="1" fill="currentColor"/>
                  </svg>
                </button>
              </>
            )}

            <button
              className={styles.playBtn}
              onClick={togglePlay}
              title={isPlaying ? 'Пауза' : 'Воспроизвести'}
            >
              {isPlaying ? (
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                  <rect x="5" y="4" width="3.5" height="12" rx="1.5" fill="white"/>
                  <rect x="11.5" y="4" width="3.5" height="12" rx="1.5" fill="white"/>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                  <polygon points="7,4 17,10 7,16" fill="white"/>
                </svg>
              )}
            </button>

            {!isVideo && (
              <button className={styles.ctrlBtn} title="Следующий" disabled>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <polygon points="4,3 12,8 4,13" fill="currentColor"/>
                  <rect x="11" y="3" width="2" height="10" rx="1" fill="currentColor"/>
                </svg>
              </button>
            )}

            <div className={styles.volumeSection}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M3 6H5.5L8.5 3V13L5.5 10H3V6Z" fill="rgba(255,255,255,0.45)"/>
                <path d="M10.5 5.5C11.5 6.3 12 7.1 12 8S11.5 9.7 10.5 10.5" stroke="rgba(255,255,255,0.45)" strokeWidth="1.3" strokeLinecap="round"/>
                <path d="M12.5 3.5C14 4.8 15 6.3 15 8S14 11.2 12.5 12.5" stroke="rgba(255,255,255,0.25)" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
              <input
                type="range" min="0" max="100"
                value={volume}
                onChange={e => setVolume(Number(e.target.value))}
                className={styles.volumeSlider}
                title={`Громкость ${volume}%`}
              />
              <span className={styles.volumeLabel}>{volume}%</span>
            </div>
          </div>
        </div>

        {/* ── Message form ─────────────────────────────── */}
        <div className={styles.messageCard}>
          <div className={styles.messageHeader}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M2 3h12a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H4l-3 2V4a1 1 0 0 1 1-1z"
                stroke="var(--ttk-red)" strokeWidth="1.4" strokeLinejoin="round"/>
            </svg>
            Написать ведущему
          </div>

          <form className={styles.messageForm} onSubmit={handleSend}>
            <textarea
              className={styles.textarea}
              placeholder="Ваше сообщение ведущему..."
              value={msgText}
              onChange={e => setMsgText(e.target.value)}
              rows={3}
              maxLength={500}
              disabled={msgSent}
            />

            {recorder.blob && (
              <div className={styles.voicePreview}>
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                  <rect x="6" y="1" width="4" height="8" rx="2" stroke="var(--ttk-red)" strokeWidth="1.4"/>
                  <path d="M3 8c0 2.8 2.2 5 5 5s5-2.2 5-5" stroke="var(--ttk-red)" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
                <span>Голосовое записано ({recorder.fmtTime(recorder.duration)})</span>
                <button type="button" className={styles.clearVoice} onClick={recorder.clear}>✕</button>
              </div>
            )}

            <div className={styles.formActions}>
              {!recorder.isRecording ? (
                <button type="button" className={styles.voiceBtn} onClick={recorder.start}>
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                    <rect x="6" y="1" width="4" height="8" rx="2" stroke="currentColor" strokeWidth="1.4"/>
                    <path d="M3 8c0 2.8 2.2 5 5 5s5-2.2 5-5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                    <line x1="8" y1="13" x2="8" y2="15" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                  </svg>
                  Записать голос
                </button>
              ) : (
                <button type="button" className={styles.voiceBtnRec} onClick={recorder.stop}>
                  <span className={styles.recDot} />
                  {recorder.fmtTime(recorder.duration)} — Остановить
                </button>
              )}

              <span className={styles.charCount}>{msgText.length}/500</span>

              <button
                type="submit"
                className={styles.sendBtn}
                disabled={(!msgText.trim() && !recorder.blob) || sending}
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                  <path d="M2 8L14 2L8 14L7 9L2 8Z" fill="currentColor"/>
                </svg>
                Отправить
              </button>
            </div>
          </form>

          {msgSent && (
            <div className={styles.sentBar}>
              Сообщение отправлено ведущему
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
