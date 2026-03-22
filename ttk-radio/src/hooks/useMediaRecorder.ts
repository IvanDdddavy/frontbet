import { useRef, useState, useCallback } from 'react'
import { toast } from '../store/toastStore'

export function useMediaRecorder() {
  const [isRecording, setIsRecording] = useState(false)
  const [duration, setDuration] = useState(0)
  const [blob, setBlob] = useState<Blob | null>(null)

  const mrRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      mrRef.current = mr
      chunksRef.current = []

      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = () => {
        const result = new Blob(chunksRef.current, { type: 'audio/webm' })
        setBlob(result)
        stream.getTracks().forEach(t => t.stop())
      }

      mr.start(250)
      setIsRecording(true)
      setDuration(0)
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000)
    } catch {
      toast.error('Нет доступа к микрофону')
    }
  }, [])

  const stop = useCallback(() => {
    mrRef.current?.stop()
    setIsRecording(false)
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }, [])

  const clear = useCallback(() => {
    setBlob(null)
    setDuration(0)
  }, [])

  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  return { isRecording, duration, blob, fmtTime, start, stop, clear }
}
