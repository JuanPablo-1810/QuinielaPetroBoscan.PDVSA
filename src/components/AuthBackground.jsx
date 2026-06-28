import { useEffect, useRef } from 'react'

// Fondo del login: constelación dorada que deriva suave y reacciona al
// cursor / al dedo. Liviano (pocas partículas en móvil) y respeta
// prefers-reduced-motion (queda estático).
export default function AuthBackground() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let w = 0, h = 0, dpr = 1
    let particles = []
    const pointer = { x: -9999, y: -9999, active: false }
    const LINK = 132      // distancia para unir dos partículas
    const PULL = 170      // radio de influencia del cursor
    const ORO = '232,180,78'

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = canvas.clientWidth
      h = canvas.clientHeight
      canvas.width = Math.floor(w * dpr)
      canvas.height = Math.floor(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const target = Math.max(14, Math.min(78, Math.round((w * h) / 14000)))
      particles = Array.from({ length: target }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.18,
        vy: (Math.random() - 0.5) * 0.18,
        r: Math.random() * 1.5 + 0.6,
      }))
    }

    function onMove(e) {
      const rect = canvas.getBoundingClientRect()
      const p = e.touches ? e.touches[0] : e
      if (!p) return
      pointer.x = p.clientX - rect.left
      pointer.y = p.clientY - rect.top
      pointer.active = true
    }
    function onLeave() { pointer.active = false; pointer.x = -9999; pointer.y = -9999 }

    function draw() {
      ctx.clearRect(0, 0, w, h)

      for (const p of particles) {
        if (!reduce) {
          if (pointer.active) {
            const dx = pointer.x - p.x, dy = pointer.y - p.y
            const d2 = dx * dx + dy * dy
            if (d2 < PULL * PULL) {
              const d = Math.sqrt(d2) || 1
              const f = (1 - d / PULL) * 0.035
              p.vx += (dx / d) * f
              p.vy += (dy / d) * f
            }
          }
          p.x += p.vx
          p.y += p.vy
          p.vx *= 0.96; p.vy *= 0.96
          // pequeña deriva constante para que nunca se detenga del todo
          p.vx += (Math.random() - 0.5) * 0.012
          p.vy += (Math.random() - 0.5) * 0.012
          if (p.x < 0) p.x += w; else if (p.x > w) p.x -= w
          if (p.y < 0) p.y += h; else if (p.y > h) p.y -= h
        }
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${ORO},0.55)`
        ctx.fill()
      }

      for (let i = 0; i < particles.length; i++) {
        const a = particles[i]
        if (pointer.active) {
          const d = Math.hypot(pointer.x - a.x, pointer.y - a.y)
          if (d < PULL) {
            ctx.strokeStyle = `rgba(${ORO},${0.22 * (1 - d / PULL)})`
            ctx.lineWidth = 0.6
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(pointer.x, pointer.y); ctx.stroke()
          }
        }
        for (let j = i + 1; j < particles.length; j++) {
          const b = particles[j]
          const dx = a.x - b.x, dy = a.y - b.y
          const d = Math.hypot(dx, dy)
          if (d < LINK) {
            ctx.strokeStyle = `rgba(${ORO},${0.1 * (1 - d / LINK)})`
            ctx.lineWidth = 0.5
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
          }
        }
      }

      if (!reduce) raf = requestAnimationFrame(draw)
    }

    let raf = 0
    resize()
    draw() // si reduce: dibuja un único fotograma estático

    window.addEventListener('resize', resize)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('mouseout', onLeave)
    window.addEventListener('touchend', onLeave)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('mouseout', onLeave)
      window.removeEventListener('touchend', onLeave)
    }
  }, [])

  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden />
}
