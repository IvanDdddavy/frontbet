/**
 * Web Audio API mixer for the host.
 * Mixes microphone input with playlist audio before sending to Icecast.
 *
 * In a real deployment, the mixed stream goes to a MediaRecorder and
 * is pushed to Icecast via the backend. Here we:
 * 1. Capture mic stream
 * 2. Play local audio file through AudioContext
 * 3. Mix both into a single destination
 * 4. Expose the mixed MediaStream for capture
 */
import { useRef, useState, useCallback } from 'react'
import { toast } from '../store/toastStore'

export interface MixerState {
  isActive: boolean
  micVolume: number
  playlistVolume: number
  isMicMuted: boolean
}

export function useAudioMixer() {
  const ctxRef      = useRef<AudioContext | null>(null)
  const micNodeRef  = useRef<MediaStreamAudioSourceNode | null>(null)
  const micGainRef  = useRef<GainNode | null>(null)
  const plGainRef   = useRef<GainNode | null>(null)
  const destRef     = useRef<MediaStreamAudioDestinationNode | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)

  const [state, setState] = useState<MixerState>({
    isActive: false,
    micVolume: 80,
    playlistVolume: 100,
    isMicMuted: false,
  })

  const start = useCallback(async (): Promise<MediaStream | null> => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      if (!AudioCtx) {
        toast.error('Web Audio API не поддерживается браузером')
        return null
      }

      const ctx = new AudioCtx()
      ctxRef.current = ctx

      // Destination node — captures mixed output as MediaStream
      const dest = ctx.createMediaStreamDestination()
      destRef.current = dest

      // Mic gain node
      const micGain = ctx.createGain()
      micGain.gain.value = state.micVolume / 100
      micGain.connect(dest)
      micGainRef.current = micGain

      // Playlist gain node
      const plGain = ctx.createGain()
      plGain.gain.value = state.playlistVolume / 100
      plGain.connect(dest)
      plGainRef.current = plGain

      // Request microphone
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      micStreamRef.current = micStream
      const micSource = ctx.createMediaStreamSource(micStream)
      micSource.connect(micGain)
      micNodeRef.current = micSource

      setState(s => ({ ...s, isActive: true }))
      toast.success('Микшер запущен')
      return dest.stream
    } catch {
      toast.error('Не удалось запустить микшер — нет доступа к микрофону')
      return null
    }
  }, [state.micVolume, state.playlistVolume])

  const stop = useCallback(() => {
    micStreamRef.current?.getTracks().forEach(t => t.stop())
    ctxRef.current?.close()
    ctxRef.current = null
    micNodeRef.current = null
    micGainRef.current = null
    plGainRef.current = null
    destRef.current = null
    micStreamRef.current = null
    setState(s => ({ ...s, isActive: false }))
    toast.info('Микшер остановлен')
  }, [])

  /**
   * Connect a HTMLAudioElement to the mixer's playlist channel.
   * Call this when you start playing a file.
   */
  const connectAudioElement = useCallback((el: HTMLAudioElement) => {
    if (!ctxRef.current || !plGainRef.current) return
    const source = ctxRef.current.createMediaElementSource(el)
    source.connect(plGainRef.current)
    // Also connect to speakers so host can monitor
    plGainRef.current.connect(ctxRef.current.destination)
  }, [])

  const setMicVolume = useCallback((vol: number) => {
    if (micGainRef.current) micGainRef.current.gain.value = vol / 100
    setState(s => ({ ...s, micVolume: vol }))
  }, [])

  const setPlaylistVolume = useCallback((vol: number) => {
    if (plGainRef.current) plGainRef.current.gain.value = vol / 100
    setState(s => ({ ...s, playlistVolume: vol }))
  }, [])

  const toggleMic = useCallback(() => {
    if (!micGainRef.current) return
    const muted = !state.isMicMuted
    micGainRef.current.gain.value = muted ? 0 : state.micVolume / 100
    setState(s => ({ ...s, isMicMuted: muted }))
  }, [state.isMicMuted, state.micVolume])

  return {
    state,
    start,
    stop,
    connectAudioElement,
    setMicVolume,
    setPlaylistVolume,
    toggleMic,
    mixedStream: destRef.current?.stream ?? null,
  }
}
