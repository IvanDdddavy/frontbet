import { useRef, useEffect, useCallback } from 'react'
import { useAudioVisualizer } from '../../hooks/useAudioVisualizer'
import styles from './AudioVisualizer.module.css'

interface Props {
  /** Pass the live audio element to connect the analyser */
  audioEl: HTMLAudioElement | null
  isPlaying: boolean
  /** Height in px, default 56 */
  height?: number
}

export function AudioVisualizer({ audioEl, isPlaying, height = 56 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const connectedRef = useRef(false)

  const viz = useAudioVisualizer(canvasRef, {
    bars:     52,
    smoothing: 0.84,
    color:    '#E3001B',
    peakColor: '#FF6070',
  })

  /* Resize canvas to match display size */
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ro = new ResizeObserver(entries => {
      for (const e of entries) {
        const { width } = e.contentRect
        canvas.width  = Math.floor(width * devicePixelRatio)
        canvas.height = Math.floor(height * devicePixelRatio)
        canvas.style.width  = `${width}px`
        canvas.style.height = `${height}px`
        const ctx = canvas.getContext('2d')
        if (ctx) ctx.scale(devicePixelRatio, devicePixelRatio)
      }
    })
    ro.observe(canvas.parentElement!)
    return () => ro.disconnect()
  }, [height])

  /* Connect analyser when audio element appears and starts playing */
  useEffect(() => {
    if (!audioEl) return
    if (isPlaying && !connectedRef.current) {
      viz.resume().then(() => viz.connect(audioEl))
      connectedRef.current = true
    } else if (!isPlaying && connectedRef.current) {
      viz.disconnect()
      connectedRef.current = false
    }
  }, [audioEl, isPlaying, viz])

  return (
    <div className={styles.wrap} style={{ height }}>
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        aria-hidden="true"
      />
    </div>
  )
}
