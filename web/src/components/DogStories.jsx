import { motion, useScroll, useTransform } from 'framer-motion'
import { useRef } from 'react'
import { PawPrint } from 'lucide-react'
import { dogStories } from '../config/draco.js'

const COUNTS = [1, 5, 20, 80]

export default function DogStories() {
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const stage = useTransform(scrollYProgress, [0.1, 0.6], [0, COUNTS.length - 1])

  return (
    <section ref={ref} className="relative bg-black py-56 px-6 overflow-hidden min-h-[120vh]">
      <motion.h2
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1 }}
        className="text-center text-3xl md:text-6xl font-semibold text-[#ece7de] max-w-3xl mx-auto"
      >
        THIS ISN'T ABOUT ONE DOG ANYMORE.
      </motion.h2>

      <div className="relative h-[40vh] flex items-center justify-center flex-wrap gap-4 mt-16 max-w-3xl mx-auto">
        <SilhouetteField stage={stage} />
      </div>

      <motion.h3
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1 }}
        className="text-center text-3xl md:text-6xl font-semibold text-[#ece7de] mt-24"
      >
        IT'S ABOUT EVERY DOG.
      </motion.h3>

      <div className="max-w-4xl mx-auto mt-24">
        {dogStories.length === 0 ? (
          <div className="text-center border border-dashed border-white/10 rounded-xl py-16 px-6">
            <PawPrint size={22} strokeWidth={1.2} className="mx-auto text-white/30" />
            <p className="mt-4 mono text-[11px] tracking-[0.2em] text-white/40">
              NO STORIES RECORDED YET
            </p>
            <p className="mt-2 text-white/30 text-sm">
              Real dog stories will appear here as they happen.
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-6">
            {dogStories.map((d) => (
              <div key={d.name} className="rounded-lg border border-white/10 p-6">
                <p className="text-white/80">{d.name}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function SilhouetteField({ stage }) {
  const dogs = Array.from({ length: 100 })
  return (
    <>
      {dogs.map((_, i) => {
        const threshold = i < 1 ? 0 : i < 5 ? 1 : i < 20 ? 2 : 3
        const opacity = useTransform(stage, (v) => (v >= threshold ? 0.55 : 0.03))
        return (
          <motion.div key={i} style={{ opacity }}>
            <PawPrint size={16} strokeWidth={1} className="text-white" />
          </motion.div>
        )
      })}
    </>
  )
}
