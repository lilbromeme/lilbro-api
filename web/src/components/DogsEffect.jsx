import { useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { PawPrint } from 'lucide-react'
import { ChapterOpen } from './ChapterMarker.jsx'

const POINTS = Array.from({ length: 90 }, () => ({
  x: Math.random() * 100,
  y: Math.random() * 100,
  d: Math.random() * 2,
}))

export default function DogsEffect() {
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const morph = useTransform(scrollYProgress, [0.15, 0.55], [0, 1])
  const pawCount = useTransform(scrollYProgress, [0.5, 1], [1, 12])

  return (
    <section
      id="chapter-impact"
      ref={ref}
      className="relative py-24 md:py-40 px-6 overflow-hidden min-h-[140vh]"
      style={{ background: 'radial-gradient(ellipse at 50% 10%, #23262b 0%, #1a1c20 45%, #131417 100%)' }}
    >
      <ChapterOpen number="05" label="IMPACT" />
      <div className="absolute inset-0">
        {POINTS.map((p, i) => (
          <motion.div
            key={i}
            className="absolute"
            style={{ left: `${p.x}%`, top: `${p.y}%`, opacity: morph }}
          >
            <motion.div style={{ opacity: useTransform(morph, [0, 1], [1, 0]) }} className="w-1 h-1 rounded-full bg-white/60" />
            <motion.div
              style={{ opacity: morph, position: 'absolute', top: 0, left: 0 }}
              className="-translate-x-1/2 -translate-y-1/2"
            >
              <PawPrint size={10} strokeWidth={1} className="text-white/50" />
            </motion.div>
          </motion.div>
        ))}
      </div>

      <div className="relative z-10 max-w-3xl mx-auto text-center space-y-16">
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1 }}
          className="text-3xl md:text-5xl font-medium text-[#ece7de]"
        >
          EVERY POINT IS A STORY.
        </motion.p>
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1 }}
          className="text-2xl md:text-4xl text-white/70 font-light"
        >
          THERE ARE MILLIONS OF DOGS WAITING FOR SOMEONE.
        </motion.p>
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1 }}
          className="text-3xl md:text-5xl font-semibold text-[#ece7de]"
        >
          WE START WITH ONE.
        </motion.p>

        <div className="flex justify-center gap-3 flex-wrap pt-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <PawGlow key={i} index={i} pawCount={pawCount} />
          ))}
        </div>
      </div>
    </section>
  )
}

function PawGlow({ index, pawCount }) {
  const opacity = useTransform(pawCount, (v) => (v > index ? 1 : 0.08))
  return (
    <motion.div style={{ opacity }} transition={{ duration: 0.4 }}>
      <PawPrint size={22} strokeWidth={1.2} className="text-white" />
    </motion.div>
  )
}
