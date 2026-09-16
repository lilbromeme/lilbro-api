import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X } from 'lucide-react'
import { project } from '../config/draco.js'

const LINKS = [
  { id: 'chapter-memory', label: 'STORY' },
  { id: 'chapter-mission', label: 'MISSION' },
  { id: 'chapter-impact', label: 'IMPACT' },
  { id: 'chapter-token', label: 'FUND' },
  { id: 'chapter-legacy', label: 'COMMUNITY' },
]

export default function FloatingNav({ onLogoClick }) {
  const [visible, setVisible] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > window.innerHeight * 1.2)
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
          transition={{ duration: 0.5 }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-3xl"
        >
          <div className="flex items-center justify-between rounded-full border border-white/10 bg-black/60 backdrop-blur-xl px-5 py-3 shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
            <button
              onClick={onLogoClick}
              className="mono text-xs tracking-[0.2em] text-white/85 hover:text-white transition"
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

            <div className="flex items-center gap-3">
              <span className="hidden md:inline mono text-xs tracking-[0.15em] text-white/85">
                {project.ticker}
              </span>
              <button
                className="md:hidden text-white/80"
                onClick={() => setOpen((o) => !o)}
                aria-label="Menu"
              >
                {open ? <X size={18} /> : <Menu size={18} />}
              </button>
            </div>
          </div>

          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
                className="md:hidden mt-2 rounded-2xl border border-white/10 bg-black/80 backdrop-blur-xl overflow-hidden"
              >
                {LINKS.map((l) => (
                  <a
                    key={l.id}
                    href={`#${l.id}`}
                    onClick={() => setOpen(false)}
                    className="block px-6 py-4 text-sm tracking-[0.1em] text-white/75 border-b border-white/5 last:border-0"
                  >
                    {l.label}
                  </a>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.nav>
      )}
    </AnimatePresence>
  )
}
