import { useEffect, useRef, useCallback } from 'react'
import { toast } from '../store/toastStore'

const _envStream = import.meta.env.VITE_STREAM_URL as string | undefined
const STREAM_URL = (_envStream && _envStream.trim()) ? _envStream.trim()
  : (import.meta.env.VITE_USE_MOCKS === 'true' ? null : '/stream')

export function useStream() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  const play = useCallback((isVideo: boolean) => {
    if (!STREAM_URL) {
      // Mock mode — just resolve immediately
      return Promise.resolve()
    }
    const el = isVideo ? videoRef.current : audioRef.current
    if (!el) return Promise.resolve()
    el.src = STREAM_URL
    return el.play().catch(() => toast.error('Не удалось запустить воспроизведение'))
  }, [])

  const pause = useCallback((isVideo: boolean) => {
    const el = isVideo ? videoRef.current : audioRef.current
    el?.pause()
  }, [])

  const setVolume = useCallback((vol: number) => {
    if (audioRef.current) audioRef.current.volume = vol / 100
    if (videoRef.current) videoRef.current.volume = vol / 100
  }, [])

  useEffect(() => {
    audioRef.current = new Audio()
    audioRef.current.preload = 'none'
    audioRef.current.onerror = () => toast.error('Ошибка аудиопотока')

    return () => {
      audioRef.current?.pause()
      audioRef.current = null
    }
  }, [])

  return { audioRef, videoRef, play, pause, setVolume }
}
