import { useRef, useState } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { memories } from '../config/draco.js'

export default function Gallery() {
  const ref = useRef(null)
  const [active, setActive] = useState(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] })
  const x = useTransform(scrollYProgress, [0, 1], ['0%', '-70%'])

  return (
    <section ref={ref} className="relative bg-black h-[280vh]">
      <div className="sticky top-0 h-screen overflow-hidden flex flex-col justify-center">
        <p className="mono text-center text-[11px] tracking-[0.25em] text-white/40 mb-10">
          HER UNIVERSE // PRIVATE ARCHIVE
        </p>
        {/* desktop horizontal scroll */}
        <motion.div style={{ x }} className="hidden md:flex gap-8 px-[10vw]">
          {memories.map((m, i) => (
            <div
              key={m.day}
              className="relative w-[60vw] max-w-xl aspect-[4/5] shrink-0 rounded-sm overflow-hidden group"
              data-cursor="view"
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
            >
              <img src={m.image} className="w-full h-full object-cover" alt={m.label} loading="lazy" />
              <div className="absolute inset-0 bg-black/40 group-hover:bg-black/70 transition" />
              <span className="absolute top-4 left-4 mono text-[11px] tracking-[0.2em] text-white/70">
                {m.label}
              </span>
              {active === i && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="absolute inset-0 flex items-center justify-center text-center px-8 text-white/80 text-sm tracking-wide"
                >
                  {m.text}
                </motion.p>
              )}
            </div>
          ))}
        </motion.div>

        {/* mobile vertical swipe cards */}
        <div className="md:hidden flex flex-col gap-6 px-6 overflow-y-auto max-h-[70vh]">
          {memories.map((m) => (
            <div key={m.day} className="relative aspect-[4/5] rounded-sm overflow-hidden">
              <img src={m.image} className="w-full h-full object-cover" alt={m.label} loading="lazy" />
              <div className="absolute inset-0 bg-black/50" />
              <span className="absolute top-3 left-3 mono text-[11px] tracking-[0.2em] text-white/70">
                {m.label}
              </span>
              <p className="absolute bottom-3 left-3 right-3 text-white/70 text-xs tracking-wide">{m.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
