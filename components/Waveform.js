'use client'
import { useEffect, useRef } from 'react'

export default function Waveform({ active = false, color = '#FFB454' }) {
  const canvasRef = useRef(null)
  const rafRef = useRef(null)
  const tRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    function resize() {
      const dpr = window.devicePixelRatio || 1
      canvas.width = canvas.clientWidth * dpr
      canvas.height = canvas.clientHeight * dpr
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.scale(dpr, dpr)
    }
    resize()
    window.addEventListener('resize', resize)

    function drawStatic() {
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      ctx.clearRect(0, 0, w, h)
      ctx.strokeStyle = color
      ctx.globalAlpha = active ? 0.9 : 0.35
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(0, h / 2)
      ctx.lineTo(w, h / 2)
      ctx.stroke()
    }

    function draw() {
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      ctx.clearRect(0, 0, w, h)
      ctx.strokeStyle = color
      ctx.globalAlpha = 0.9
      ctx.lineWidth = 1.5
      ctx.beginPath()
      const amp = active ? h * 0.32 : h * 0.06
      const freq = active ? 0.045 : 0.02
      for (let x = 0; x <= w; x += 2) {
        const y =
          h / 2 +
          Math.sin(x * freq + tRef.current) * amp * Math.sin(tRef.current * 0.6 + x * 0.01)
        if (x === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
      tRef.current += active ? 0.09 : 0.03
      rafRef.current = requestAnimationFrame(draw)
    }

    if (reduceMotion) drawStatic()
    else draw()

    return () => {
      window.removeEventListener('resize', resize)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [active, color])

  return <canvas ref={canvasRef} className="w-full h-10" />
}
