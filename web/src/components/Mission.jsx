import { motion } from 'framer-motion'
import { PawPrint, HeartPulse, Stethoscope, Home } from 'lucide-react'
import { ChapterOpen, ChapterClose } from './ChapterMarker.jsx'

const CATEGORIES = [
  { icon: PawPrint, label: 'RESCUE' },
  { icon: HeartPulse, label: 'FOOD' },
  { icon: Stethoscope, label: 'MEDICAL' },
  { icon: Home, label: 'SHELTER' },
]

export default function Mission() {
  return (
    <section
      id="chapter-mission"
      className="relative py-20 md:py-32 px-6 overflow-hidden"
      style={{ background: 'radial-gradient(ellipse at 50% 20%, #202226 0%, #18191b 60%, #131417 100%)' }}
    >
      <ChapterOpen number="04" label="THE MISSION" />

      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 1 }}
        className="text-center text-2xl md:text-4xl font-medium text-[#f5f3ee] max-w-2xl mx-auto"
      >
        SO WE BUILT SOMETHING IN HER NAME.
      </motion.h2>

      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1, delay: 0.2 }}
        className="text-center mt-10"
      >
        <h3 className="text-6xl md:text-8xl font-semibold text-[#f5f3ee]">DRACO</h3>
        <p className="mono mt-3 text-[11px] tracking-[0.2em] text-[var(--accent-blue)]">
          A COMMUNITY FOR DOGS THAT STILL NEED SOMEONE.
        </p>
      </motion.div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 max-w-4xl mx-auto mt-20">
        {CATEGORIES.map((item, i) => {
          const Icon = item.icon
          return (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: i * 0.1 }}
              whileHover={{ y: -6 }}
              className="group relative rounded-2xl border border-white/10 bg-white/[0.05] p-6 md:p-8 flex flex-col items-center gap-4 text-center overflow-hidden"
            >
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition duration-500 bg-[radial-gradient(circle_at_50%_0%,rgba(143,164,184,0.25),transparent_70%)]" />
              <div className="relative w-14 h-14 rounded-full border border-white/15 flex items-center justify-center bg-white/5 transition-transform duration-500 group-hover:scale-110">
                <Icon size={22} strokeWidth={1.2} className="text-[var(--accent-blue)]" />
              </div>
              <span className="relative mono text-[11px] tracking-[0.2em] text-white/70">
                {item.label}
              </span>
            </motion.div>
          )
        })}
      </div>

      <ChapterClose number="04" />
    </section>
  )
}
