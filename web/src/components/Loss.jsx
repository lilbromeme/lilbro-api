import { useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import RevealLines from './RevealLines.jsx'
import { ChapterOpen, ChapterClose } from './ChapterMarker.jsx'

export default function Loss() {
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  // grief → purpose: background slowly warms from void black to blue-gray
  const bg = useTransform(
    scrollYProgress,
    [0, 0.55, 0.8, 1],
    ['#08090a', '#08090a', '#12161b', '#161c22']
  )

  return (
    <motion.section
      id="chapter-loss"
      ref={ref}
      style={{ background: bg }}
      className="relative py-20 md:py-32 px-6 flex flex-col items-center justify-center gap-16"
    >
      <ChapterOpen number="03" label="THE LOSS" />

      <RevealLines
        className="text-center"
        lineClassName="text-3xl md:text-6xl font-medium text-[#f5f3ee] leading-tight"
        lines={['AND THEN ONE DAY,', 'THERE WAS NO TOMORROW.']}
      />
      <RevealLines
        className="text-center"
        lineClassName="text-2xl md:text-5xl text-white/70 font-light"
        lines={["WE COULDN'T SAVE HER."]}
      />
      <RevealLines
        className="text-center"
        lineClassName="text-4xl md:text-7xl font-semibold text-[#f5f3ee]"
        lines={['BUT MAYBE WE CAN HELP THEM.']}
      />

      <ChapterClose number="03" />
    </motion.section>
  )
}
