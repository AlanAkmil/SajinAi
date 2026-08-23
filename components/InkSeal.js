'use client'
import { useEffect, useRef } from 'react'

// Segel tinta hidup — cincin tinta melebar saat Sajin "berpikir",
// tenang berdenyut pelan saat idle. Semua CSS/canvas transform only,
// ga ada layout thrashing jadi aman di HP low-end.
export default function InkSeal({ active = false, size = 44 }) {
  const canvasRef = useRef(null)
  const rafRef = useRef(null)
  const tRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const dpr = window.devicePixelRatio || 1

    canvas.width = size * dpr
    canvas.height = size * dpr
    ctx.scale(dpr, dpr)

    function drawStatic() {
      ctx.clearRect(0, 0, size, size)
      ctx.strokeStyle = '#C23B22'
      ctx.globalAlpha = 0.6
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(size / 2, size / 2, size / 2 - 4, 0, Math.PI * 2)
      ctx.stroke()
    }

    function draw() {
      ctx.clearRect(0, 0, size, size)
      const cx = size / 2
      const cy = size / 2
      const baseR = size / 2 - 4

      if (active) {
        for (let i = 0; i < 3; i++) {
          const phase = (tRef.current + i * 0.6) % 1.8
          const r = baseR * (0.3 + phase * 0.5)
          const alpha = Math.max(0, 1 - phase / 1.8)
          ctx.strokeStyle = '#C23B22'
          ctx.globalAlpha = alpha * 0.8
          ctx.lineWidth = 1.8
          ctx.beginPath()
          ctx.arc(cx, cy, r, 0, Math.PI * 2)
          ctx.stroke()
        }
        ctx.globalAlpha = 0.9
        ctx.fillStyle = '#C23B22'
        ctx.beginPath()
        ctx.arc(cx, cy, 3, 0, Math.PI * 2)
        ctx.fill()
      } else {
        const pulse = 0.85 + Math.sin(tRef.current * 1.5) * 0.15
        ctx.strokeStyle = '#C23B22'
        ctx.globalAlpha = 0.45
        ctx.lineWidth = 1.6
        ctx.beginPath()
        ctx.arc(cx, cy, baseR * pulse, 0, Math.PI * 2)
        ctx.stroke()
      }

      tRef.current += active ? 0.035 : 0.02
      rafRef.current = requestAnimationFrame(draw)
    }

    if (reduceMotion) drawStatic()
    else draw()

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [active, size])

  return <canvas ref={canvasRef} style={{ width: size, height: size, display: 'block' }} />
}
