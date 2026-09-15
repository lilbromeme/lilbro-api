import { motion } from 'framer-motion'
import { AtSign, Send } from 'lucide-react'
import { social } from '../config/draco.js'
import { ChapterOpen } from './ChapterMarker.jsx'

const FRAGMENTS = ['FOR DRACO.', 'FOR EVERY DOG.', 'ONE MEMORY.', 'ONE COMMUNITY.', 'ONE MORE LIFE SAVED.']

export default function Community() {
  return (
    <section
      id="chapter-legacy"
      className="relative py-20 md:py-32 px-6 overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #0e0e10 0%, #14110d 100%)' }}
    >
      <ChapterOpen number="07" label="LEGACY" />
      <div className="relative max-w-4xl mx-auto flex flex-wrap justify-center gap-6 mb-24">
        {FRAGMENTS.map((f, i) => (
          <motion.div
            key={f}
            initial={{ opacity: 0, y: 20, rotate: (i % 2 === 0 ? -1 : 1) * 2 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 0.7, delay: i * 0.12 }}
            className="px-6 py-4 rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur text-white/80 text-sm tracking-wide"
          >
            {f}
          </motion.div>
        ))}
      </div>

      <div className="text-center">
        <h2 className="text-3xl md:text-5xl font-semibold text-[#ece7de]">JOIN THE PACK</h2>
        <div className="flex items-center justify-center gap-6 mt-10">
          <a
            href={social.x}
            target="_blank"
            rel="noreferrer"
            data-cursor="view"
            className="flex items-center gap-2 px-6 py-3 rounded-full border border-white/15 text-white/80 hover:text-white hover:border-white/30 transition"
          >
            <AtSign size={16} /> X
          </a>
          <a
            href={social.telegram}
            target="_blank"
            rel="noreferrer"
            data-cursor="view"
            className="flex items-center gap-2 px-6 py-3 rounded-full border border-white/15 text-white/80 hover:text-white hover:border-white/30 transition"
          >
            <Send size={16} /> TELEGRAM
          </a>
        </div>
      </div>
    </section>
  )
}
