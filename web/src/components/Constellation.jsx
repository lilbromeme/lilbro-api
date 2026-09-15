import { useEffect, useRef, useState } from 'react'

// Subtle paw-shaped constellation woven into a broader star field.
// Stars connect to nearby stars when the cursor approaches.
const PAW_POINTS = [
  [0.5, 0.42], // center pad
  [0.42, 0.32], [0.5, 0.28], [0.58, 0.32], [0.63, 0.4],
]

export default function Constellation({ className = '' }) {
  const canvasRef = useRef(null)
  const mouse = useRef({ x: -9999, y: -9999 })
  const [message, setMessage] = useState(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf
    let stars = []
    let w, h

    function resize() {
      w = canvas.width = canvas.offsetWidth * devicePixelRatio
      h = canvas.height = canvas.offsetHeight * devicePixelRatio
      const count = Math.min(160, Math.floor((canvas.offsetWidth * canvas.offsetHeight) / 9000))
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.4 + 0.3,
        tw: Math.random() * Math.PI * 2,
        vx: (Math.random() - 0.5) * 0.06,
        vy: (Math.random() - 0.5) * 0.06,
      }))
      // embed the paw constellation
      PAW_POINTS.forEach(([px, py]) => {
        stars.push({ x: px * w, y: py * h, r: 1.8, tw: Math.random() * Math.PI * 2, paw: true, vx: 0, vy: 0 })
      })
    }
    resize()
    window.addEventListener('resize', resize)

    function draw(t) {
      ctx.clearRect(0, 0, w, h)
      const mx = mouse.current.x * devicePixelRatio
      const my = mouse.current.y * devicePixelRatio

      // connect paw points to each other faintly always
      ctx.strokeStyle = 'rgba(236,231,222,0.08)'
      ctx.lineWidth = 1
      const pawStars = stars.filter((s) => s.paw)
      for (let i = 0; i < pawStars.length - 1; i++) {
        ctx.beginPath()
        ctx.moveTo(pawStars[i].x, pawStars[i].y)
        ctx.lineTo(pawStars[i + 1].x, pawStars[i + 1].y)
        ctx.stroke()
      }

      for (const s of stars) {
        if (!reduce && !s.paw) {
          s.x += s.vx
          s.y += s.vy
          if (s.x < 0 || s.x > w) s.vx *= -1
          if (s.y < 0 || s.y > h) s.vy *= -1
        }
        s.tw += 0.01
        const flicker = 0.5 + Math.sin(s.tw) * 0.5
        const dist = Math.hypot(s.x - mx, s.y - my)
        const near = dist < 140 * devicePixelRatio

        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r * (near ? 1.8 : 1), 0, Math.PI * 2)
        ctx.fillStyle = s.paw
          ? `rgba(236,231,222,${0.6 + flicker * 0.4})`
          : `rgba(236,231,222,${0.15 + flicker * 0.35})`
        ctx.fill()

        if (near) {
          ctx.beginPath()
          ctx.moveTo(s.x, s.y)
          ctx.lineTo(mx, my)
          ctx.strokeStyle = `rgba(236,231,222,${0.15 * (1 - dist / (140 * devicePixelRatio))})`
          ctx.lineWidth = 0.6
          ctx.stroke()
        }
      }
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)

    function onMove(e) {
      const rect = canvas.getBoundingClientRect()
      mouse.current.x = e.clientX - rect.left
      mouse.current.y = e.clientY - rect.top
    }
    function onTouch(e) {
      if (!e.touches[0]) return
      const rect = canvas.getBoundingClientRect()
      mouse.current.x = e.touches[0].clientX - rect.left
      mouse.current.y = e.touches[0].clientY - rect.top
    }
    function onClick(e) {
      const rect = canvas.getBoundingClientRect()
      const cx = e.clientX - rect.left
      const cy = e.clientY - rect.top
      const hit = stars.find((s) => Math.hypot(s.x / devicePixelRatio - cx, s.y / devicePixelRatio - cy) < 10)
      if (hit) setMessage('a memory, still alive')
    }

    canvas.addEventListener('mousemove', onMove)
    canvas.addEventListener('touchmove', onTouch, { passive: true })
    canvas.addEventListener('click', onClick)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      canvas.removeEventListener('mousemove', onMove)
      canvas.removeEventListener('touchmove', onTouch)
      canvas.removeEventListener('click', onClick)
    }
  }, [])

  useEffect(() => {
    if (!message) return
    const t = setTimeout(() => setMessage(null), 2200)
    return () => clearTimeout(t)
  }, [message])

  return (
    <div className={`relative ${className}`} data-cursor="follow">
      <canvas ref={canvasRef} className="w-full h-full block" />
      {message && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 mono text-[11px] tracking-[0.2em] text-white/60">
          {message}
        </div>
      )}
    </div>
  )
}
