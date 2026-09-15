import { motion } from 'framer-motion'
import RevealLines from './RevealLines.jsx'

export default function Memory() {
  return (
    <section id="story" className="relative bg-black py-40 px-6">
      <RevealLines
        className="max-w-4xl mx-auto text-center space-y-6"
        lineClassName="text-4xl md:text-7xl font-semibold tracking-tight text-[#ece7de]"
        lines={["SHE WASN'T A TOKEN.", 'SHE WAS A DOG.', 'SHE WAS FAMILY.']}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 1.2 }}
        className="max-w-3xl mx-auto mt-24 relative"
      >
        <div className="relative rounded-sm overflow-hidden aspect-[4/5]" data-cursor="view">
          <img src="/images/draco-hero.svg" alt="Draco" className="w-full h-full object-cover" loading="lazy" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
        </div>
        <p className="mt-10 text-center text-white/60 text-base md:text-lg leading-relaxed max-w-xl mx-auto">
          "Draco was part of our everyday life. The kind of presence you don't
          realize you've built your world around until it's gone."
        </p>
      </motion.div>
    </section>
  )
}
