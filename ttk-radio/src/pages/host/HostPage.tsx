import { useState, useRef, useEffect, useCallback } from 'react'
import { useStreamStore } from '../../store/streamStore'
import { useMessageStore, MsgStatus } from '../../store/messageStore'
import { useAuthStore } from '../../store/authStore'
import { useWebSocket } from '../../hooks/useWebSocket'
import { useMediaRecorder } from '../../hooks/useMediaRecorder'
import { useHistoryStore } from '../../store/historyStore'
import { toast } from '../../store/toastStore'
import { mediaApi, validateMediaFile } from '../../api/media'
import type { MediaFileDto, PlaylistDto } from '../../api/media'
import { messagesApi } from '../../api/messages'
import type { MessageDto } from '../../api/messages'
import { streamApi } from '../../api/stream'
import { MixerPanel } from '../../components/host/MixerPanel'
import styles from './HostPage.module.css'

const STATUS_LABEL: Record<MsgStatus, string> = {
  new: 'Новый',
  in_progress: 'В работе',
  done: 'Завершено',
}

const STATUS_NEXT: Record<MsgStatus, MsgStatus | null> = {
  new: 'in_progress',
  in_progress: 'done',
  done: null,
}

export function HostPage() {
  const { token } = useAuthStore()
  const { isLive, isVideo, volume, setLive, setVideo, setVolume } = useStreamStore()
  const { listeners, sendWs } = useWebSocket(token)
  const { messages, setStatus: setLocalStatus } = useMessageStore()
  const recorder = useMediaRecorder()
  const { startSession, endSession, updatePeak } = useHistoryStore()

  // Library & playlist state
  const [library, setLibrary]         = useState<MediaFileDto[]>([])
  const [playlists, setPlaylists]     = useState<PlaylistDto[]>([])
  const [activePlaylist, setActivePlaylist] = useState<PlaylistDto | null>(null)
  const [libraryLoading, setLibraryLoading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)

  // Messages state (from API, not just local store)
  const [apiMessages, setApiMessages]   = useState<MessageDto[]>([])
  const [msgsLoading, setMsgsLoading]   = useState(false)
  const [showArchive, setShowArchive]   = useState(false)
  const [archiveMsgs, setArchiveMsgs]   = useState<MessageDto[]>([])

  // UI state
  const [tab, setTab]         = useState<'broadcast' | 'messages'>('broadcast')
  const [loopMode, setLoopMode]     = useState(false)
  const [shuffleMode, setShuffleMode] = useState(false)
  const [currentIdx, setCurrentIdx]   = useState<number | null>(null)
  const [playToken, setPlayToken]       = useState(0)   // bumped to force re-play same idx
  const [isHostPlaying, setIsHostPlaying] = useState(false)
  const [isMicLive, setIsMicLive]         = useState(false)
  const playlistItemsRef = useRef<typeof playlistItems>([])
  const [uploadError, setUploadError] = useState('')

  // Webcam
  const webcamRef       = useRef<HTMLVideoElement>(null)
  const webcamStreamRef = useRef<MediaStream | null>(null)
  const micStreamRef    = useRef<MediaStream | null>(null)
  const fileInputRef    = useRef<HTMLInputElement>(null)
  const hostAudioRef    = useRef<HTMLAudioElement | null>(null)
  const videoWsRef      = useRef<WebSocket | null>(null)
  const videoRecRef     = useRef<MediaRecorder | null>(null)

  // ── Data loading ───────────────────────────────────────────────

  const loadLibrary = useCallback(async () => {
    setLibraryLoading(true)
    try {
      const files = await mediaApi.getLibrary()
      setLibrary(files)
    } catch { /* toast shown by interceptor */ }
    finally { setLibraryLoading(false) }
  }, [])

  const loadPlaylists = useCallback(async () => {
    try {
      const pls = await mediaApi.getPlaylists()
      setPlaylists(pls)
      if (pls.length > 0 && !activePlaylist) setActivePlaylist(pls[0])
    } catch { /* ignore */ }
  }, [])

  const loadMessages = useCallback(async () => {
    setMsgsLoading(true)
    try {
      const msgs = await messagesApi.getAll(false)
      setApiMessages(msgs)
    } catch { /* ignore */ }
    finally { setMsgsLoading(false) }
  }, [])

  const loadArchive = useCallback(async () => {
    try {
      const all = await messagesApi.getAll(true)
      setArchiveMsgs(all.filter(m => m.status === 'done'))
    } catch { /* ignore */ }
  }, [])

  // Initial load
  useEffect(() => {
    loadLibrary()
    loadPlaylists()
    loadMessages()
  }, [loadLibrary, loadPlaylists, loadMessages])

  // Poll messages every 10s when tab is messages
  useEffect(() => {
    if (tab !== 'messages') return
    const id = setInterval(loadMessages, 10000)
    return () => clearInterval(id)
  }, [tab, loadMessages])

  // Cleanup webcam + video WS + mic on unmount
  useEffect(() => () => {
    videoRecRef.current?.stop()
    videoWsRef.current?.close()
    webcamStreamRef.current?.getTracks().forEach(t => t.stop())
    micStreamRef.current?.getTracks().forEach(t => t.stop())
    setIsMicLive(false)
  }, [])

  // Save recorder blob to library
  const prevBlobRef = useRef<Blob | null>(null)
  useEffect(() => {
    if (!recorder.blob || recorder.blob === prevBlobRef.current) return
    prevBlobRef.current = recorder.blob
    const recFile = new File([recorder.blob], `rec_${new Date().toLocaleTimeString('ru')}.webm`, { type: 'audio/webm' })
    handleUploadFile(recFile)
  }, [recorder.blob])

  // Track peak listeners
  useEffect(() => { if (isLive) updatePeak(listeners) }, [listeners, isLive])

  // Play audio track from playlist when currentIdx changes
  useEffect(() => {
    if (currentIdx === null) {
      hostAudioRef.current?.pause()
      setIsHostPlaying(false)
      return
    }
    const items = playlistItemsRef.current
    if (items.length === 0) return
    const item = items[currentIdx]
    if (!item) return

    if (!hostAudioRef.current) {
      hostAudioRef.current = new Audio()
    }
    const audio = hostAudioRef.current
    audio.pause()
    audio.src = item.mediaFile.url
    audio.volume = volume / 100

    // Use ref in onended to always get fresh values (no stale closure)
    audio.onended = () => {
      const currentItems = playlistItemsRef.current
      setCurrentIdx(prev => {
        if (prev === null) return null
        const next = prev + 1
        if (next >= currentItems.length) return loopMode ? 0 : null
        return next
      })
    }

    audio.play()
      .then(() => setIsHostPlaying(true))
      .catch(() => toast.error('Не удалось воспроизвести файл'))
  }, [currentIdx, playToken])  // eslint-disable-line react-hooks/exhaustive-deps

  // Sync host audio volume
  useEffect(() => {
    if (hostAudioRef.current) hostAudioRef.current.volume = volume / 100
  }, [volume])

  // Stop host audio on unmount
  useEffect(() => () => { hostAudioRef.current?.pause() }, [])

  // Play specific index — always triggers useEffect even if idx unchanged
  const playAtIndex = (idx: number) => {
    setCurrentIdx(idx)
    setPlayToken(t => t + 1)
  }

  // Toggle pause/resume for host player
  const toggleHostPlay = () => {
    const audio = hostAudioRef.current
    if (!audio) return
    if (isHostPlaying) {
      audio.pause()
      setIsHostPlaying(false)
    } else {
      audio.play().then(() => setIsHostPlaying(true)).catch(() => {})
    }
  }

  const playPrev = () => {
    const items = playlistItemsRef.current
    if (items.length === 0) return
    const next = currentIdx === null ? 0
      : currentIdx - 1 < 0 ? (loopMode ? items.length - 1 : 0)
      : currentIdx - 1
    playAtIndex(next)
  }

  const playNext = () => {
    const items = playlistItemsRef.current
    if (items.length === 0) return
    const next = currentIdx === null ? 0
      : currentIdx + 1 >= items.length ? (loopMode ? 0 : null)
      : currentIdx + 1
    if (next === null) { setCurrentIdx(null); return }
    playAtIndex(next)
  }

  // ── Actions ────────────────────────────────────────────────────

  const handleToggleLive = async () => {
    const next = !isLive
    // When going live, isVideo is true only if webcam is actively streaming
    const goingLiveWithVideo = next && isVideo && !!webcamStreamRef.current
    try {
      await streamApi.setState({ isLive: next, isVideo: goingLiveWithVideo })
      setLive(next)
      if (!goingLiveWithVideo && isVideo) setVideo(false)
      sendWs({ type: 'stream_state_change', isLive: next, isVideo: goingLiveWithVideo })
      toast[next ? 'success' : 'info'](next ? 'Эфир запущен' : 'Эфир остановлен')
      if (next) startSession(goingLiveWithVideo)
      else {
        // Stop webcam if live ends
        if (isVideo) await stopVideoStream()
        endSession(apiMessages.length)
      }
    } catch { /* interceptor shows toast */ }
  }

  const handleUploadFile = async (file: File) => {
    setUploadError('')
    const err = validateMediaFile(file)
    if (err) { setUploadError(err); return }

    setUploadProgress(0)
    try {
      const uploaded = await mediaApi.uploadFile(file, setUploadProgress)
      setLibrary(l => [uploaded, ...l])
      toast.success(`Файл «${uploaded.filename}» загружен`)
    } catch { /* interceptor */ }
    finally { setUploadProgress(null) }
  }

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    for (const f of files) await handleUploadFile(f)
    e.target.value = ''
  }

  const handleDeleteFile = async (id: string) => {
    try {
      await mediaApi.deleteFile(id)
      setLibrary(l => l.filter(f => f.id !== id))
      // Remove from active playlist if present
      if (activePlaylist) {
        const updItems = activePlaylist.items.filter(i => i.mediaFile.id !== id)
        const updPl = { ...activePlaylist, items: updItems }
        setActivePlaylist(updPl)
      }
      toast.info('Файл удалён')
    } catch { /* interceptor */ }
  }

  // Ensure playlist exists, then add file
  const addToPlaylist = async (file: MediaFileDto) => {
    let pl = activePlaylist
    if (!pl) {
      try {
        pl = await mediaApi.createPlaylist('Основной плейлист')
        setPlaylists(p => [...p, pl!])
        setActivePlaylist(pl)
      } catch { return }
    }
    if (pl.items.some(i => i.mediaFile.id === file.id)) return

    const newItemIds = [...pl.items.map(i => i.mediaFile.id), file.id]
    try {
      const updated = await mediaApi.updatePlaylist(pl.id, { item_ids: newItemIds })
      setActivePlaylist(updated)
      setPlaylists(p => p.map(x => x.id === updated.id ? updated : x))
    } catch { /* interceptor */ }
  }

  const removeFromPlaylist = async (mediaFileId: string) => {
    if (!activePlaylist) return
    const removedIdx = activePlaylist.items.findIndex(i => i.mediaFile.id === mediaFileId)
    const newItemIds = activePlaylist.items
      .filter(i => i.mediaFile.id !== mediaFileId)
      .map(i => i.mediaFile.id)
    try {
      const updated = await mediaApi.updatePlaylist(activePlaylist.id, { item_ids: newItemIds })
      setActivePlaylist(updated)

      // If removed track is currently playing — stop it
      if (removedIdx === currentIdx) {
        hostAudioRef.current?.pause()
        if (hostAudioRef.current) hostAudioRef.current.src = ''
        setIsHostPlaying(false)
        setCurrentIdx(null)
      } else if (currentIdx !== null && removedIdx < currentIdx) {
        // Track before current was removed — shift index down
        setCurrentIdx(currentIdx - 1)
      }
    } catch { /* interceptor */ }
  }

  const moveTrack = async (fromIdx: number, toIdx: number) => {
    if (!activePlaylist) return
    if (toIdx < 0 || toIdx >= activePlaylist.items.length) return
    const ids = activePlaylist.items.map(i => i.mediaFile.id)
    const [moved] = ids.splice(fromIdx, 1)
    ids.splice(toIdx, 0, moved)
    try {
      const updated = await mediaApi.updatePlaylist(activePlaylist.id, { item_ids: ids })
      setActivePlaylist(updated)
      // Keep currentIdx pointing to the same track after reorder
      if (currentIdx === fromIdx) {
        setCurrentIdx(toIdx)
      } else if (currentIdx !== null) {
        if (fromIdx < currentIdx && toIdx >= currentIdx) setCurrentIdx(currentIdx - 1)
        else if (fromIdx > currentIdx && toIdx <= currentIdx) setCurrentIdx(currentIdx + 1)
      }
    } catch { /* interceptor */ }
  }

  const handleShufflePlaylist = async () => {
    if (!activePlaylist) return
    const shuffled = [...activePlaylist.items].sort(() => Math.random() - 0.5).map(i => i.mediaFile.id)
    try {
      const updated = await mediaApi.updatePlaylist(activePlaylist.id, { item_ids: shuffled, shuffle_mode: true })
      setActivePlaylist(updated)
      setShuffleMode(true)
    } catch { /* interceptor */ }
  }

  const handleLoopToggle = async () => {
    if (!activePlaylist) return
    const next = !loopMode
    try {
      const updated = await mediaApi.updatePlaylist(activePlaylist.id, { loop_mode: next })
      setActivePlaylist(updated)
      setLoopMode(next)
    } catch { /* interceptor */ }
  }

  const startVideoStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      webcamStreamRef.current = stream
      if (webcamRef.current) {
        webcamRef.current.srcObject = stream
        webcamRef.current.style.display = 'block'
        await webcamRef.current.play().catch(() => {})
      }

      // Open WebSocket to push video chunks to listeners
      const wsBase = (import.meta.env.VITE_WS_URL as string) || `ws://${location.host}`
      const pushUrl = wsBase.replace('/ws', '') + `/ws/video/push?token=${encodeURIComponent(useAuthStore.getState().token ?? '')}`
      const vws = new WebSocket(pushUrl)
      videoWsRef.current = vws

      vws.onopen = () => {
        // Start MediaRecorder once WS is open
        const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
          ? 'video/webm;codecs=vp9,opus'
          : 'video/webm'
        const rec = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 800_000 })
        videoRecRef.current = rec
        rec.ondataavailable = (e) => {
          if (e.data.size > 0 && vws.readyState === WebSocket.OPEN) {
            vws.send(e.data)
          }
        }
        rec.start(500) // chunk every 500ms
      }

      setVideo(true)
      await streamApi.setState({ isVideo: true })
      sendWs({ type: 'stream_state_change', isLive, isVideo: true })
      toast.success('Видеотрансляция запущена')
    } catch (err) {
      toast.error('Нет доступа к камере или микрофону')
    }
  }

  const stopVideoStream = async () => {
    videoRecRef.current?.stop()
    videoRecRef.current = null
    videoWsRef.current?.close()
    videoWsRef.current = null
    webcamStreamRef.current?.getTracks().forEach(t => t.stop())
    webcamStreamRef.current = null
    if (webcamRef.current) webcamRef.current.srcObject = null
    try {
      await streamApi.setState({ isVideo: false })
    } catch { /* ignore */ }
    setVideo(false)
    sendWs({ type: 'stream_state_change', isLive, isVideo: false })
    toast.info('Видеотрансляция остановлена')
  }

  const startMicStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      micStreamRef.current = stream
      setIsMicLive(true)
      toast.success('Микрофон подключён — эфир идёт')
    } catch {
      toast.error('Нет доступа к микрофону')
    }
  }

  const stopMicStream = () => {
    micStreamRef.current?.getTracks().forEach(t => t.stop())
    micStreamRef.current = null
    setIsMicLive(false)
    toast.info('Микрофон отключён')
  }


  const handleSetStatus = async (id: string, status: MsgStatus) => {
    try {
      const updated = await messagesApi.setStatus(id, status)
      setApiMessages(msgs => msgs.map(m => m.id === id ? updated : m))
      setLocalStatus(id, status)
      sendWs({ type: 'message_status', id, status })
    } catch { /* interceptor */ }
  }

  const handleShowArchive = async () => {
    const next = !showArchive
    setShowArchive(next)
    if (next) loadArchive()
  }

  const fmtBytes = (b: number) => {
    if (b > 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} МБ`
    return `${(b / 1024).toFixed(0)} КБ`
  }

  const activeMessages  = apiMessages.filter(m => m.status !== 'done')
  const newMsgCount     = apiMessages.filter(m => m.status === 'new').length
  const playlistItems   = activePlaylist?.items ?? []
  playlistItemsRef.current = playlistItems

  return (
    <div className={`${styles.page} page-enter`}>
      <div className={styles.container}>

        {/* Page header */}
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>Раздел ведущего</h1>
            <p className={styles.pageSubtitle}>Управление эфиром и плейлистом</p>
          </div>
          <div className={styles.onAirToggle}>
            <span className={styles.onAirLabel} data-live={isLive}>
              <span className={styles.dot} data-live={isLive} />
              {isLive ? 'ЭФИР АКТИВЕН' : 'ЭФИР ВЫКЛЮЧЕН'}
            </span>
            <button
              className={`${styles.bigToggle} ${isLive ? styles.bigToggleOn : ''}`}
              onClick={handleToggleLive}
            >
              {isLive ? 'Выключить эфир' : 'Включить эфир'}
            </button>
            {isLive && (
              <button
                className={`${styles.micLiveBtn} ${isMicLive ? styles.micLiveBtnOn : ''}`}
                onClick={() => isMicLive ? stopMicStream() : startMicStream()}
                title={isMicLive ? 'Выключить микрофон' : 'Выйти в эфир с микро'}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <rect x="6" y="1" width="4" height="8" rx="2" stroke="currentColor" strokeWidth="1.4"/>
                  <path d="M3 8c0 2.8 2.2 5 5 5s5-2.2 5-5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                  <line x1="8" y1="13" x2="8" y2="15" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                  {isMicLive && <line x1="2" y1="2" x2="14" y2="14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>}
                </svg>
                {isMicLive ? 'Выкл. микро' : 'Микро в эфир'}
              </button>
            )}
          </div>
        </div>

        {/* Webcam preview */}
        <div className={styles.webcamWrap} style={{ display: isVideo ? 'block' : 'none' }}>
          <video ref={webcamRef} className={styles.webcamEl} muted playsInline />
          <div className={styles.webcamBadge}>
            <span className={styles.recDotSmall} />
            ПРЯМОЙ ЭФИР
          </div>
        </div>

        {/* Stats */}
        <div className={styles.statsRow}>
          <div className={styles.statItem}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <circle cx="6" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M2 13c0-2.2 1.8-4 4-4s4 1.8 4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              <circle cx="11.5" cy="4.5" r="2" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M13 13c0-1.7-1-3-2.5-3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            <span>{listeners} слушател{listeners === 1 ? 'ь' : (listeners >= 2 && listeners <= 4) ? 'я' : 'ей'} онлайн</span>
          </div>
          <div className={styles.statItem}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <path d="M2 3h12a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H4l-3 2V4a1 1 0 0 1 1-1z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
            </svg>
            <span>{newMsgCount} новых сообщений</span>
          </div>
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          <button className={`${styles.tab} ${tab === 'broadcast' ? styles.tabActive : ''}`} onClick={() => setTab('broadcast')}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4"/>
              <polygon points="6.5,5.5 11.5,8 6.5,10.5" fill="currentColor"/>
            </svg>
            Плеер и плейлист
          </button>
          <button className={`${styles.tab} ${tab === 'messages' ? styles.tabActive : ''}`} onClick={() => { setTab('messages'); loadMessages() }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M2 3h12a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H4l-3 2V4a1 1 0 0 1 1-1z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
            </svg>
            Сообщения
            {newMsgCount > 0 && <span className={styles.badge}>{newMsgCount}</span>}
          </button>
        </div>

        {/* ── BROADCAST TAB ─────────────────────────── */}
        {tab === 'broadcast' && (
          <div className={styles.broadcastGrid}>
            <div className={styles.leftCol}>

              {/* Broadcast controls */}
              <div className={styles.card}>
                <div className={styles.cardTitle}>Управление эфиром</div>
                <div className={styles.controlRow}>
                  <span className={styles.controlLabel}>Громкость для слушателей</span>
                  <div className={styles.volumeRow}>
                    <input type="range" min="0" max="100" value={volume}
                      onChange={e => {
                        const v = Number(e.target.value)
                        setVolume(v)
                        sendWs({ type: 'volume_change', volume: v })
                      }}
                      className={styles.slider} />
                    <span className={styles.volumeVal}>{volume}%</span>
                  </div>
                </div>
                <div className={styles.controlRow}>
                  <span className={styles.controlLabel}>Видеотрансляция (вебкам)</span>
                  <div style={{display:'flex', flexDirection:'column', alignItems:'flex-end', gap: 3}}>
                    <button
                      className={`${styles.switchBtn} ${isVideo ? styles.switchOn : ''}`}
                      onClick={() => isVideo ? stopVideoStream() : startVideoStream()}
                    >
                      {isVideo ? 'Выключить камеру' : 'Включить камеру'}
                    </button>
                    <span style={{fontSize:11, color:'rgba(255,255,255,0.3)', letterSpacing:'0.01em'}}>
                      необязательно — эфир работает без камеры
                    </span>
                  </div>
                </div>
              </div>

              {/* Audio mixer */}
              <MixerPanel />

              {/* Microphone recording */}
              <div className={styles.card}>
                <div className={styles.cardTitle}>Запись с микрофона</div>
                {!recorder.isRecording ? (
                  <button className={styles.recBtn} onClick={recorder.start}>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                      <rect x="6" y="1" width="4" height="8" rx="2" stroke="currentColor" strokeWidth="1.4"/>
                      <path d="M3 8c0 2.8 2.2 5 5 5s5-2.2 5-5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                      <line x1="8" y1="13" x2="8" y2="15" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                    </svg>
                    Начать запись
                  </button>
                ) : (
                  <button className={styles.recBtnActive} onClick={recorder.stop}>
                    <span className={styles.recDot} />
                    {recorder.fmtTime(recorder.duration)} — Остановить и сохранить
                  </button>
                )}
                <p className={styles.fileHint} style={{ marginTop: 8 }}>
                  Запись автоматически добавляется в медиатеку
                </p>
              </div>

              {/* Media library */}
              <div className={styles.card}>
                <div className={styles.cardTitleRow}>
                  <span className={styles.cardTitle}>Медиатека</span>
                  <button className={styles.uploadBtn} onClick={() => fileInputRef.current?.click()}>
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                      <path d="M8 2v9M4 5l4-3 4 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M2 13h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                    Загрузить
                  </button>
                  <input ref={fileInputRef} type="file" accept=".mp3,.wav,.ogg,.mp4,.webm" multiple hidden onChange={handleFileInput}/>
                </div>

                {uploadProgress !== null && (
                  <div className={styles.progressWrap}>
                    <div className={styles.progressBar} style={{ width: `${uploadProgress}%` }} />
                    <span className={styles.progressLabel}>{uploadProgress}%</span>
                  </div>
                )}
                {uploadError && <div className={styles.uploadError}>{uploadError}</div>}
                <div className={styles.fileHint}>MP3, WAV, OGG (до 50 МБ) · MP4, WebM (до 1 ГБ)</div>

                {libraryLoading ? (
                  <div className={styles.loadingRow}>Загрузка...</div>
                ) : (
                  <div className={styles.fileList}>
                    {library.length === 0 && <div className={styles.emptyPlaylist}>Медиатека пуста</div>}
                    {library.map(file => (
                      <div key={file.id} className={styles.fileRow}>
                        <span className={`${styles.fileTypeIcon} ${file.mediaType === 'video' ? styles.videoIcon : ''}`}>
                          {file.mediaType === 'audio' ? '♪' : '▶'}
                        </span>
                        <div className={styles.fileInfo}>
                          <span className={styles.fileName}>{file.filename}</span>
                          <span className={styles.fileMeta}>{fmtBytes(file.sizeBytes)}</span>
                        </div>
                        <button
                          className={styles.addBtn}
                          onClick={() => addToPlaylist(file)}
                          disabled={!!activePlaylist?.items.some(i => i.mediaFile.id === file.id)}
                          title="Добавить в плейлист"
                        >
                          {activePlaylist?.items.some(i => i.mediaFile.id === file.id) ? '✓' : '+'}
                        </button>
                        <button
                          className={styles.removeBtn}
                          onClick={() => handleDeleteFile(file.id)}
                          title="Удалить файл"
                        >✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── PLAYLIST ──────────────────────────── */}
            <div className={styles.rightCol}>
              <div className={styles.card}>
                <div className={styles.cardTitleRow}>
                  <span className={styles.cardTitle}>Плейлист</span>
                  <div className={styles.playlistControls}>
                    <button className={`${styles.modeBtn} ${loopMode ? styles.modeBtnOn : ''}`} onClick={handleLoopToggle} title="Зациклить">↺</button>
                    <button className={`${styles.modeBtn} ${shuffleMode ? styles.modeBtnOn : ''}`} onClick={handleShufflePlaylist} title="Перемешать">⇄</button>
                  </div>
                </div>

                {playlistItems.length === 0 ? (
                  <div className={styles.emptyPlaylist}>
                    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                      <rect x="4" y="8" width="24" height="3" rx="1.5" fill="currentColor" opacity="0.2"/>
                      <rect x="4" y="14" width="18" height="3" rx="1.5" fill="currentColor" opacity="0.2"/>
                      <rect x="4" y="20" width="20" height="3" rx="1.5" fill="currentColor" opacity="0.2"/>
                    </svg>
                    <span>Добавьте файлы из медиатеки</span>
                  </div>
                ) : (
                  <div className={styles.playlistList}>
                    {playlistItems.map((item, idx) => {
                      const isActive = currentIdx === idx
                      return (
                        <div
                          key={item.id}
                          className={`${styles.playlistRow} ${isActive ? styles.playlistRowActive : ''}`}
                          onClick={() => playAtIndex(idx)}
                        >
                          <button
                            className={styles.trackPlayBtn}
                            onClick={e => { e.stopPropagation(); isActive ? toggleHostPlay() : playAtIndex(idx) }}
                            title={isActive && isHostPlaying ? 'Пауза' : 'Воспроизвести'}
                          >
                            {isActive && isHostPlaying ? (
                              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                <rect x="1" y="1" width="3" height="8" rx="1" fill="currentColor"/>
                                <rect x="6" y="1" width="3" height="8" rx="1" fill="currentColor"/>
                              </svg>
                            ) : (
                              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                <polygon points="2,1 9,5 2,9" fill="currentColor"/>
                              </svg>
                            )}
                          </button>
                          <span className={styles.playlistNum}>{idx + 1}</span>
                          <div className={styles.fileInfo}>
                            <span className={styles.fileName}>{item.mediaFile.filename}</span>
                            <span className={styles.fileMeta}>{fmtBytes(item.mediaFile.sizeBytes)}</span>
                          </div>
                          <div className={styles.orderBtns}>
                            <button
                              className={styles.orderBtn}
                              disabled={idx === 0}
                              onClick={e => { e.stopPropagation(); moveTrack(idx, idx - 1) }}
                              title="Вверх"
                            >
                              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                <path d="M5 8V2M2 5l3-3 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </button>
                            <button
                              className={styles.orderBtn}
                              disabled={idx === playlistItems.length - 1}
                              onClick={e => { e.stopPropagation(); moveTrack(idx, idx + 1) }}
                              title="Вниз"
                            >
                              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                <path d="M5 2v6M2 5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </button>
                          </div>
                          <button className={styles.removeBtn} onClick={e => { e.stopPropagation(); removeFromPlaylist(item.mediaFile.id) }}>✕</button>
                        </div>
                      )
                    })}
                  </div>
                )}

                {playlistItems.length > 0 && (
                  <div className={styles.playlistFooter}>
                    <span>{playlistItems.length} файл(ов)</span>
                    {currentIdx !== null && (
                      <div className={styles.playerControls}>
                        <button className={styles.ctrlSmallBtn} onClick={playPrev} title="Предыдущий">
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <polygon points="10,1 3,6 10,11" fill="currentColor"/>
                            <rect x="1" y="1" width="2" height="10" rx="1" fill="currentColor"/>
                          </svg>
                        </button>
                        <button className={styles.playPauseBtn} onClick={toggleHostPlay} title={isHostPlaying ? 'Пауза' : 'Воспроизвести'}>
                          {isHostPlaying ? (
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                              <rect x="2" y="1" width="3" height="10" rx="1" fill="currentColor"/>
                              <rect x="7" y="1" width="3" height="10" rx="1" fill="currentColor"/>
                            </svg>
                          ) : (
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                              <polygon points="2,1 11,6 2,11" fill="currentColor"/>
                            </svg>
                          )}
                        </button>
                        <button className={styles.ctrlSmallBtn} onClick={playNext} title="Следующий">
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <polygon points="2,1 9,6 2,11" fill="currentColor"/>
                            <rect x="9" y="1" width="2" height="10" rx="1" fill="currentColor"/>
                          </svg>
                        </button>
                      </div>
                    )}
                    <button className={styles.playAllBtn} onClick={() => currentIdx !== null ? (hostAudioRef.current?.pause(), setIsHostPlaying(false), setCurrentIdx(null)) : playAtIndex(0)}>
                      {currentIdx !== null ? '■ Стоп' : '▶ Воспроизвести'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── MESSAGES TAB ──────────────────────────── */}
        {tab === 'messages' && (
          <div className={styles.messagesSection}>
            {msgsLoading && activeMessages.length === 0 ? (
              <div className={styles.emptyMsg}>Загрузка...</div>
            ) : activeMessages.length === 0 ? (
              <div className={styles.emptyMsg}>Нет активных сообщений</div>
            ) : (
              <div className={styles.msgList}>
                {activeMessages.map(msg => (
                  <div key={msg.id} className={styles.msgCard} data-status={msg.status}>
                    <div className={styles.msgTop}>
                      <span className={styles.msgLogin}>{msg.senderLogin}</span>
                      <span className={`${styles.statusBadge} ${styles[`status_${msg.status}`]}`}>
                        {STATUS_LABEL[msg.status as MsgStatus]}
                      </span>
                      <span className={styles.msgTime}>
                        {new Date(msg.createdAt).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    {msg.content && <p className={styles.msgContent}>{msg.content}</p>}
                    {msg.voicePath && (
                      <div className={styles.msgVoice}>
                        <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                          <rect x="6" y="1" width="4" height="8" rx="2" stroke="currentColor" strokeWidth="1.4"/>
                          <path d="M3 8c0 2.8 2.2 5 5 5s5-2.2 5-5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                        </svg>
                        <audio controls src={`/media/${msg.voicePath}`} style={{ height: 28 }} />
                      </div>
                    )}
                    {STATUS_NEXT[msg.status as MsgStatus] && (
                      <button
                        className={styles.nextStatusBtn}
                        onClick={() => handleSetStatus(msg.id, STATUS_NEXT[msg.status as MsgStatus]!)}
                      >
                        {msg.status === 'new' ? 'Взять в работу' : 'Завершить'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <button className={styles.archiveToggle} onClick={handleShowArchive}>
              Архив ({archiveMsgs.length || '?'}) {showArchive ? '▲' : '▼'}
            </button>

            {showArchive && (
              <div className={styles.msgList}>
                {archiveMsgs.length === 0
                  ? <div className={styles.emptyMsg}>Архив пуст</div>
                  : archiveMsgs.map(msg => (
                    <div key={msg.id} className={styles.msgCard} data-status="done" style={{ opacity: 0.6 }}>
                      <div className={styles.msgTop}>
                        <span className={styles.msgLogin}>{msg.senderLogin}</span>
                        <span className={`${styles.statusBadge} ${styles.status_done}`}>Завершено</span>
                        <span className={styles.msgTime}>
                          {new Date(msg.createdAt).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      {msg.content && <p className={styles.msgContent}>{msg.content}</p>}
                    </div>
                  ))
                }
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
