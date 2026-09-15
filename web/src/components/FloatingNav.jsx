import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { project } from '../config/draco.js'

const LINKS = [
  { id: 'story', label: 'STORY' },
  { id: 'mission', label: 'MISSION' },
  { id: 'impact', label: 'IMPACT' },
  { id: 'fund', label: 'FUND' },
  { id: 'community', label: 'COMMUNITY' },
]

export default function FloatingNav({ onLogoClick }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > window.innerHeight * 1.6)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <AnimatePresence>
      {visible && (
        <motion.nav
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.6 }}
          className="fixed top-5 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-3xl"
        >
          <div className="flex items-center justify-between rounded-full border border-white/10 bg-white/5 backdrop-blur-xl px-5 py-3 shadow-[0_0_40px_rgba(0,0,0,0.4)]">
            <button
              onClick={onLogoClick}
              className="mono text-xs tracking-[0.2em] text-white/80 hover:text-white transition"
              data-cursor="view"
            >
              DRACO
            </button>
            <div className="hidden md:flex gap-6">
              {LINKS.map((l) => (
                <a
                  key={l.id}
                  href={`#${l.id}`}
                  className="text-[11px] tracking-[0.15em] text-white/60 hover:text-white transition"
                >
                  {l.label}
                </a>
              ))}
            </div>
            <span className="mono text-xs tracking-[0.15em] text-white/80">{project.ticker}</span>
          </div>
        </motion.nav>
      )}
    </AnimatePresence>
  )
}
