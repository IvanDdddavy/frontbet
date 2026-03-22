import { useRef, useCallback, useEffect } from 'react'

export interface VisualizerHandle {
  /** Call once when audio element is ready */
  connect: (audio: HTMLAudioElement) => void
  /** Call when audio stops / disconnects */
  disconnect: () => void
  /** AudioContext — must be resumed after user gesture */
  resume: () => Promise<void>
}

export function useAudioVisualizer(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  options: {
    bars?: number
    minDecibels?: number
    maxDecibels?: number
    smoothing?: number
    color?: string
    peakColor?: string
  } = {}
): VisualizerHandle {
  const {
    bars      = 48,
    minDecibels = -90,
    maxDecibels = -10,
    smoothing  = 0.82,
    color      = '#E3001B',
    peakColor  = '#FF4D61',
  } = options

  const ctxRef      = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceRef   = useRef<MediaElementAudioSourceNode | null>(null)
  const rafRef      = useRef<number>(0)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dataRef     = useRef<any>(new Uint8Array(0))
  const peaksRef    = useRef<Float32Array>(new Float32Array(bars))
  const peakTimers  = useRef<Float32Array>(new Float32Array(bars))

  /* ── Draw one frame ───────────────────────── */
  const draw = useCallback(() => {
    rafRef.current = requestAnimationFrame(draw)

    const canvas = canvasRef.current
    const analyser = analyserRef.current
    if (!canvas || !analyser) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.width
    const H = canvas.height

    analyser.getByteFrequencyData(dataRef.current as unknown as Uint8Array<ArrayBuffer>)

    // Clear
    ctx.clearRect(0, 0, W, H)

    const barW   = Math.floor((W - (bars - 1) * 2) / bars)
    const gap    = 2
    const step   = Math.floor(dataRef.current.length / bars)

    for (let i = 0; i < bars; i++) {
      // Average a small bucket for smoother look
      let sum = 0
      for (let j = 0; j < step; j++) sum += dataRef.current[i * step + j]
      const raw = sum / step / 255  // 0..1

      const barH = Math.max(3, raw * H * 0.92)
      const x    = i * (barW + gap)
      const y    = H - barH

      // Peak decay
      if (barH > peaksRef.current[i]) {
        peaksRef.current[i] = barH
        peakTimers.current[i] = 60  // frames to hold
      } else {
        peakTimers.current[i] -= 1
        if (peakTimers.current[i] <= 0) {
          peaksRef.current[i] = Math.max(3, peaksRef.current[i] - 1.5)
        }
      }

      // Bar gradient: bottom full color → top slightly lighter
      const grad = ctx.createLinearGradient(0, y, 0, H)
      grad.addColorStop(0, peakColor)
      grad.addColorStop(1, color)
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.roundRect(x, y, barW, barH, [2, 2, 0, 0])
      ctx.fill()

      // Peak dot
      const peakY = H - peaksRef.current[i] - 3
      ctx.fillStyle = '#ffffff'
      ctx.globalAlpha = 0.55
      ctx.beginPath()
      ctx.roundRect(x, peakY, barW, 2, 1)
      ctx.fill()
      ctx.globalAlpha = 1
    }
  }, [bars, color, peakColor, canvasRef])

  /* ── Mock animation when no real audio ──── */
  const drawMock = useCallback(() => {
    rafRef.current = requestAnimationFrame(drawMock)

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.width
    const H = canvas.height
    ctx.clearRect(0, 0, W, H)

    const barW = Math.floor((W - (bars - 1) * 2) / bars)
    const gap  = 2
    const t    = Date.now() / 1000

    for (let i = 0; i < bars; i++) {
      // Organic undulating pattern
      const wave = (
        Math.sin(t * 1.2 + i * 0.35) * 0.3 +
        Math.sin(t * 0.7 + i * 0.18) * 0.25 +
        Math.sin(t * 2.1 + i * 0.55) * 0.12 +
        0.18
      )
      const raw  = Math.max(0.04, Math.min(1, wave))
      const barH = raw * H * 0.80
      const x    = i * (barW + gap)
      const y    = H - barH

      const grad = ctx.createLinearGradient(0, y, 0, H)
      grad.addColorStop(0, peakColor)
      grad.addColorStop(1, color)
      ctx.fillStyle = grad
      ctx.globalAlpha = 0.55  // dimmer when not playing
      ctx.beginPath()
      ctx.roundRect(x, y, barW, barH, [2, 2, 0, 0])
      ctx.fill()
      ctx.globalAlpha = 1
    }
  }, [bars, color, peakColor, canvasRef])

  /* ── Public API ──────────────────────────── */
  const connect = useCallback((audio: HTMLAudioElement) => {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioCtx) return

    // Reuse existing context if possible
    if (!ctxRef.current || ctxRef.current.state === 'closed') {
      ctxRef.current = new AudioCtx()
    }
    const actx = ctxRef.current

    // Avoid double-connecting same element
    if (sourceRef.current) {
      try { sourceRef.current.disconnect() } catch { /* ignore */ }
    }
    const source = actx.createMediaElementSource(audio)
    sourceRef.current = source

    const analyser = actx.createAnalyser()
    analyser.fftSize        = 256
    analyser.minDecibels    = minDecibels
    analyser.maxDecibels    = maxDecibels
    analyser.smoothingTimeConstant = smoothing
    analyserRef.current = analyser

    dataRef.current  = new Uint8Array(analyser.frequencyBinCount)
    peaksRef.current = new Float32Array(bars)
    peakTimers.current = new Float32Array(bars)

    source.connect(analyser)
    analyser.connect(actx.destination)

    // Stop mock, start real
    cancelAnimationFrame(rafRef.current)
    draw()
  }, [bars, minDecibels, maxDecibels, smoothing, draw])

  const disconnect = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    analyserRef.current = null
    // restart mock
    drawMock()
  }, [drawMock])

  const resume = useCallback(async () => {
    if (ctxRef.current?.state === 'suspended') {
      await ctxRef.current.resume()
    }
  }, [])

  /* ── Auto-start mock on mount ────────────── */
  useEffect(() => {
    const id = requestAnimationFrame(() => drawMock())
    rafRef.current = id
    return () => {
      cancelAnimationFrame(rafRef.current)
      try { ctxRef.current?.close() } catch { /* ignore */ }
    }
  }, [drawMock])

  return { connect, disconnect, resume }
}
