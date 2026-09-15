import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { memories } from '../config/draco.js'
import PhotoReveal from './PhotoReveal.jsx'
import { ChapterOpen, ChapterClose } from './ChapterMarker.jsx'

// Irregular editorial sizing — not a uniform grid.
const SPANS = ['row-span-2', '', '', 'row-span-2', '', 'col-span-2']

export default function Gallery() {
  const [lightbox, setLightbox] = useState(null)

  return (
    <section
      id="chapter-story"
      className="relative pt-20 pb-20 md:pt-32 md:pb-32 px-6"
      style={{ background: 'linear-gradient(180deg, #0a0908 0%, #111010 100%)' }}
    >
      <ChapterOpen number="02" label="HER STORY" />

      <div className="max-w-2xl mb-16">
        <h2 className="text-2xl md:text-4xl font-medium text-[#f5f3ee]">HER UNIVERSE.</h2>
        <p className="mt-3 text-[#a8a8a8] text-sm md:text-base">
          A private archive of moments. Tap any photograph.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 auto-rows-[160px] md:auto-rows-[220px] max-w-5xl mx-auto">
        {memories.map((m, i) => (
          <motion.button
            key={m.day}
            onClick={() => setLightbox(m)}
            className={`relative rounded-xl overflow-hidden border border-white/10 group ${SPANS[i % SPANS.length]}`}
            data-cursor="view"
            whileTap={{ scale: 0.97 }}
          >
            <motion.img
              initial={{ opacity: 0.7, filter: 'blur(8px)', scale: 1.03 }}
              whileInView={{ opacity: 1, filter: 'blur(0px)', scale: 1 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 1 }}
              src={m.image}
              alt={m.label}
              className="w-full h-full object-cover group-hover:scale-105 transition duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
            <span className="absolute bottom-3 left-3 mono text-[10px] tracking-[0.2em] text-white/80">
              {m.label}
            </span>
          </motion.button>
        ))}
      </div>

      <ChapterClose number="02" />

      <AnimatePresence>
        {lightbox && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-black/92 backdrop-blur-md flex items-center justify-center p-6"
            onClick={() => setLightbox(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="relative max-w-lg w-full"
            >
              <button
                onClick={() => setLightbox(null)}
                className="absolute -top-10 right-0 text-white/60 hover:text-white"
              >
                <X size={22} />
              </button>
              <PhotoReveal src={lightbox.image} alt={lightbox.label} className="aspect-[4/5]" />
              <p className="mono text-[11px] tracking-[0.2em] text-white/50 mt-4">
                DRACO / MEMORY — {lightbox.label}
              </p>
              <p className="text-white/70 text-sm mt-1">
                {lightbox.text === 'MEMORY PLACEHOLDER' ? 'Memory caption coming soon.' : lightbox.text}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
