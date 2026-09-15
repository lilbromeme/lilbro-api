import { motion } from 'framer-motion'
import PhotoReveal from './PhotoReveal.jsx'
import { ChapterOpen, ChapterClose } from './ChapterMarker.jsx'

const MOMENTS = [
  { text: "SHE WASN'T A TOKEN.", photo: '/images/draco-hero.jpg' },
  { text: 'SHE WAS A DOG.', photo: '/images/draco-2.jpg' },
  { text: 'SHE WAS FAMILY.', photo: null },
]

export default function Memory() {
  return (
    <section
      id="chapter-memory"
      className="relative pt-20 pb-20 md:pt-32 md:pb-32 px-6"
      style={{ background: 'radial-gradient(ellipse at 50% 20%, #1c1916 0%, #11100f 55%, #0a0908 100%)' }}
    >
      <ChapterOpen number="01" label="MEMORY" />

      <div className="max-w-3xl mx-auto space-y-28">
        {MOMENTS.map((m, i) => (
          <div key={m.text} className="space-y-14">
            <motion.p
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.6 }}
              transition={{ duration: 0.9 }}
              className="text-4xl md:text-7xl font-semibold tracking-tight text-[#f5f3ee] text-center"
            >
              {m.text}
            </motion.p>

            {m.photo && (
              <PhotoReveal
                src={m.photo}
                alt="Draco"
                glow
                className="aspect-[4/5] max-w-xl mx-auto"
              />
            )}
          </div>
        ))}
      </div>

      <div className="max-w-xl mx-auto mt-24 text-center">
        <p className="text-lg md:text-xl text-[#c9c4ba] leading-relaxed">
          Draco was part of our everyday life — the kind of presence you don't
          realize you've built your world around until it's gone.
        </p>
      </div>

      <ChapterClose number="01" />
    </section>
  )
}
