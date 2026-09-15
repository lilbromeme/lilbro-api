import { motion } from 'framer-motion'
import { PawPrint } from 'lucide-react'

export default function FinalCTA() {
  return (
    <section className="relative bg-black py-56 px-6 flex flex-col items-center justify-center text-center gap-10">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.4 }}
        className="w-full max-w-xs aspect-square rounded-full overflow-hidden opacity-70"
      >
        <img src="/images/draco-hero.svg" className="w-full h-full object-cover" alt="Draco" loading="lazy" />
      </motion.div>

      <motion.h2
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.2 }}
        className="text-5xl md:text-7xl font-semibold text-[#ece7de]"
      >
        DRACO
      </motion.h2>

      <motion.p
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1, delay: 0.3 }}
        className="text-lg md:text-2xl text-white/70 font-light"
      >
        SHE LEFT US WITH A MEMORY.
      </motion.p>
      <motion.p
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1, delay: 0.6 }}
        className="text-lg md:text-2xl text-white/70 font-light"
      >
        WE'RE TURNING IT INTO A LEGACY.
      </motion.p>

      <motion.p
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1, delay: 0.9 }}
        className="text-2xl md:text-4xl font-semibold text-[#ece7de] mt-6"
      >
        FOR DRACO.
        <br />
        FOR EVERY DOG.
      </motion.p>

      <PawPrint size={20} strokeWidth={1.2} className="text-white/50 mt-6" />

      <a
        href="#community"
        data-cursor="view"
        className="mono text-[12px] tracking-[0.2em] text-white/60 hover:text-white transition"
      >
        ENTER THE COMMUNITY →
      </a>
    </section>
  )
}
