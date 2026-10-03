'use client'

import { useEffect, useRef } from 'react'

type Line = {
  base: number
  amp: number
  len: number
  speed: number
  phase: number
  tilt: number
  alpha: number
  width: number
}

// Fine gold lines flowing slowly behind a dark header, the same motion as
// the home page. It fills its parent, which needs `relative` (and `isolate`
// or a z-index) so the lines sit behind the header's text.
export default function HeaderLines() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(function () {
    const canvasEl = canvasRef.current
    if (!canvasEl) return
    const ctxOrNull = canvasEl.getContext('2d')
    if (!ctxOrNull) return
    const canvas: HTMLCanvasElement = canvasEl
    const ctx: CanvasRenderingContext2D = ctxOrNull

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let lines: Line[] = []
    let w = 0
    let h = 0
    let clock = 0
    let visible = true
    let running = false
    let frame = 0

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = canvas.clientWidth
      h = canvas.clientHeight
      canvas.width = Math.max(1, Math.round(w * dpr))
      canvas.height = Math.max(1, Math.round(h * dpr))
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      lines = []
      const count = Math.max(8, Math.round(h / 30))
      for (let i = 0; i < count; i++) {
        const t = count > 1 ? i / (count - 1) : 0.5
        lines.push({
          base: h * (0.06 + t * 0.92),
          amp: 10 + Math.random() * 24,
          len: 380 + Math.random() * 520,
          speed: (0.12 + Math.random() * 0.22) * (i % 2 ? 1 : -1),
          phase: Math.random() * Math.PI * 2,
          tilt: -0.08 + t * 0.16,
          alpha: 0.06 + Math.random() * 0.12,
          width: Math.random() < 0.2 ? 1.6 : 0.8,
        })
      }
    }

    function draw() {
      ctx.clearRect(0, 0, w, h)
      for (let i = 0; i < lines.length; i++) {
        const L = lines[i]
        ctx.beginPath()
        for (let x = -20; x <= w + 20; x += 12) {
          const y = L.base + (x - w / 2) * L.tilt
            + Math.sin(x / L.len * Math.PI * 2 + L.phase + clock * L.speed) * L.amp
            + Math.sin(x / (L.len * 0.37) + clock * L.speed * 1.7) * L.amp * 0.18
          if (x === -20) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.strokeStyle = 'rgba(214, 188, 138,' + L.alpha + ')'
        ctx.lineWidth = L.width
        ctx.stroke()
      }
    }

    function loop() {
      if (!visible) {
        running = false
        return
      }
      clock += 0.016
      draw()
      frame = requestAnimationFrame(loop)
    }

    function start() {
      if (reduce || !visible || running) return
      running = true
      frame = requestAnimationFrame(loop)
    }

    function onResize() {
      resize()
      draw()
    }

    resize()
    draw()
    window.addEventListener('resize', onResize)

    const observer = new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting
      start()
    })
    observer.observe(canvas)
    start()

    return function () {
      window.removeEventListener('resize', onResize)
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [])

  return <canvas ref={canvasRef} aria-hidden="true" className="hm-header-lines" />
}
