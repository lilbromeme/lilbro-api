import { useEffect, useRef, useState } from 'react'

export default function CustomCursor() {
  const dotRef = useRef(null)
  const labelRef = useRef(null)
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    const isFine = window.matchMedia('(hover: hover) and (pointer: fine)').matches
    setEnabled(isFine)
    if (!isFine) return

    const dot = dotRef.current
    const label = labelRef.current
    let x = 0, y = 0

    const move = (e) => {
      x = e.clientX
      y = e.clientY
      dot.style.left = `${x}px`
      dot.style.top = `${y}px`
      label.style.left = `${x}px`
      label.style.top = `${y}px`
    }

    const setState = (e) => {
      const target = e.target.closest('[data-cursor]')
      if (target) {
        const kind = target.dataset.cursor
        if (kind === 'view' || kind === 'follow') {
          dot.style.width = '64px'
          dot.style.height = '64px'
          dot.style.background = 'rgba(236,231,222,0.15)'
          label.style.opacity = '1'
          label.textContent = kind.toUpperCase()
          label.style.color = '#ece7de'
        } else {
          dot.style.width = '22px'
          dot.style.height = '22px'
          label.style.opacity = '0'
        }
      } else {
        dot.style.width = '10px'
        dot.style.height = '10px'
        dot.style.background = '#ece7de'
        label.style.opacity = '0'
      }
    }

    window.addEventListener('mousemove', move)
    window.addEventListener('mouseover', setState)
    return () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseover', setState)
    }
  }, [])

  if (!enabled) return null

  return (
    <>
      <div ref={dotRef} className="cursor-dot" />
      <div ref={labelRef} className="cursor-label" />
    </>
  )
}
