import { motion, AnimatePresence } from 'framer-motion'
import { chapters } from '../config/chapters.js'
import useActiveChapter from '../hooks/useActiveChapter.js'

export default function ChapterIndicator() {
  const active = useActiveChapter()

  return (
    <>
      {/* desktop vertical rail */}
      <div className="hidden lg:flex fixed right-8 top-1/2 -translate-y-1/2 z-40 flex-col gap-5">
        {chapters.map((c, i) => (
          <a
            key={c.id}
            href={`#${c.id}`}
            className="group flex items-center justify-end gap-3"
          >
            <span
              className={`text-[10px] mono tracking-[0.2em] transition-all duration-500 ${
                i === active
                  ? 'text-[var(--accent-blue)] opacity-100'
                  : 'text-white/30 opacity-0 group-hover:opacity-70'
              }`}
            >
              {c.label}
            </span>
            <span
              className={`block rounded-full transition-all duration-500 ${
                i === active
                  ? 'w-2.5 h-2.5 bg-[var(--accent-blue)] shadow-[0_0_10px_rgba(143,164,184,0.8)]'
                  : 'w-1.5 h-1.5 bg-white/25'
              }`}
            />
          </a>
        ))}
      </div>

      {/* mobile compact indicator — pinned top-right, under the navbar, out of content's way */}
      <div className="lg:hidden fixed top-[4.5rem] right-4 z-40 pointer-events-none">
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.35 }}
            className="flex items-center gap-1.5 rounded-full border border-white/10 bg-black/50 backdrop-blur-lg px-3 py-1.5"
          >
            <span className="mono text-[9px] tracking-[0.1em] text-white/50">
              {chapters[active].number}/{String(chapters.length).padStart(2, '0')}
            </span>
            <span className="w-px h-2.5 bg-white/15" />
            <span className="mono text-[9px] tracking-[0.15em] text-[var(--accent-blue)]">
              {chapters[active].label}
            </span>
          </motion.div>
        </AnimatePresence>
      </div>
    </>
  )
}
