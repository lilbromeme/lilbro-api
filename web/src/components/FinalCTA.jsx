import { motion } from 'framer-motion'
import { PawPrint, ArrowUp } from 'lucide-react'
import PhotoReveal from './PhotoReveal.jsx'

export default function FinalCTA() {
  return (
    <section
      className="relative py-24 md:py-40 px-6 flex flex-col items-center justify-center text-center gap-10"
      style={{ background: 'radial-gradient(ellipse at 50% 30%, #241d15 0%, #14110d 60%, #0a0908 100%)' }}
    >
      <PhotoReveal
        src="/images/draco-hero.jpg"
        alt="Draco"
        glow
        className="w-full max-w-xs aspect-square rounded-full"
        imgClassName="brightness-110"
      />

      <motion.h2
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.2 }}
        className="text-5xl md:text-7xl font-semibold text-[#f5f3ee]"
      >
        DRACO
      </motion.h2>

      <motion.p
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1, delay: 0.3 }}
        className="text-lg md:text-2xl text-white/75 font-light"
      >
        SHE LEFT US WITH A MEMORY.
      </motion.p>
      <motion.p
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1, delay: 0.6 }}
        className="text-lg md:text-2xl text-white/75 font-light"
      >
        WE'RE TURNING IT INTO A LEGACY.
      </motion.p>

      <motion.p
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1, delay: 0.9 }}
        className="text-2xl md:text-4xl font-semibold text-[#f5f3ee] mt-6"
      >
        FOR DRACO.
        <br />
        FOR EVERY DOG.
      </motion.p>

      <a
        href="#chapter-legacy"
        data-cursor="view"
        className="mt-6 px-8 py-3 rounded-full bg-[var(--accent-warm)] text-[#14110d] text-sm font-medium tracking-[0.15em] hover:opacity-90 transition"
      >
        JOIN THE COMMUNITY
      </a>

      <a
        href="#top"
        className="mt-4 flex items-center gap-2 mono text-[11px] tracking-[0.2em] text-white/40 hover:text-white/70 transition"
      >
        SCROLL BACK <ArrowUp size={12} />
      </a>

      <PawPrint size={18} strokeWidth={1.2} className="text-white/40 mt-2" />
    </section>
  )
}
