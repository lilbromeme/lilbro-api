import { useEffect, useState } from 'react'
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion'
import Constellation from './Constellation.jsx'

const LINES = ['A MEMORY IS STILL ALIVE.', 'HER NAME WAS DRACO.']

export default function Hero({ scrollRef }) {
  const [stage, setStage] = useState(0) // 0 cursor, 1 line1, 2 line2, 3 reveal
  const { scrollYProgress } = useScroll({
    target: scrollRef,
    offset: ['start start', 'end start'],
  })
  const imgOpacity = useTransform(scrollYProgress, [0, 0.5], [0.88, 1])
  const imgScale = useTransform(scrollYProgress, [0, 1], [1.06, 1])
  const titleY = useTransform(scrollYProgress, [0, 1], [0, -60])

  useEffect(() => {
    const t1 = setTimeout(() => setStage(1), 1200)
    const t2 = setTimeout(() => setStage(2), 3400)
    const t3 = setTimeout(() => setStage(3), 5600)
    return () => [t1, t2, t3].forEach(clearTimeout)
  }, [])

  return (
    <section ref={scrollRef} className="relative h-[220vh] bg-black">
      <div className="sticky top-0 h-screen w-full overflow-hidden flex items-center justify-center">
        <AnimatePresence>
          {stage < 3 && (
            <motion.div
              key="opening"
              exit={{ opacity: 0 }}
              transition={{ duration: 1.2 }}
              className="absolute inset-0 flex items-center justify-center z-20 px-6"
            >
              {stage === 0 && (
                <motion.div
                  animate={{ opacity: [1, 0.2, 1] }}
                  transition={{ duration: 1.1, repeat: Infinity }}
                  className="w-[2px] h-6 bg-white/80"
                />
              )}
              <AnimatePresence mode="wait">
                {stage >= 1 && stage < 3 && (
                  <motion.p
                    key={stage}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1.4 }}
                    className="text-center text-lg md:text-3xl tracking-[0.12em] text-white/85 font-light"
                  >
                    {LINES[stage - 1]}
                  </motion.p>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        {/* constellation forming */}
        <motion.div
          className="absolute inset-0 z-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: stage >= 2 ? 1 : 0 }}
          transition={{ duration: 2 }}
        >
          <Constellation className="w-full h-full" />
        </motion.div>

        {/* Draco photo emerging */}
        <motion.div
          className="absolute inset-0 z-0"
          style={{ opacity: stage >= 3 ? imgOpacity : 0, scale: imgScale }}
        >
          <img
            src="/images/draco-hero.jpg"
            alt="Draco"
            className="w-full h-full object-cover brightness-[1.08] saturate-[1.05]"
            loading="eager"
          />
          {/* gradient overlay for legibility, not a solid black mask */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/40" />
          {/* soft warm highlight */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_40%,rgba(197,184,165,0.12),transparent_60%)]" />
          {/* edge vignette only */}
          <div className="absolute inset-0 shadow-[inset_0_0_180px_90px_rgba(0,0,0,0.55)]" />
        </motion.div>

        {/* title */}
        {stage >= 3 && (
          <motion.div
            style={{ y: titleY }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.6, delay: 0.4 }}
            className="relative z-20 text-center px-6"
          >
            <h1 className="text-[15vw] md:text-[13vw] leading-none font-semibold tracking-tight text-[#f5f3ee] drop-shadow-[0_4px_30px_rgba(0,0,0,0.6)]">
              DRACO
            </h1>
            <p className="mt-5 text-sm md:text-lg tracking-[0.2em] text-white/80">
              ONE DOG.<br className="md:hidden" /> A MILLION SECOND CHANCES.
            </p>
          </motion.div>
        )}

        {stage >= 3 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.6, duration: 1.2 }}
            className="absolute bottom-10 left-1/2 -translate-x-1/2 z-20 mono text-[11px] tracking-[0.25em] text-white/50"
          >
            SCROLL TO REMEMBER ↓
          </motion.div>
        )}
      </div>
    </section>
  )
}
