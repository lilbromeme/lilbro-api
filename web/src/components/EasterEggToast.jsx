import { AnimatePresence, motion } from 'framer-motion'

export default function EasterEggToast({ message }) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[9997] mono text-xs tracking-[0.2em] text-white/80 bg-white/5 border border-white/10 backdrop-blur px-5 py-3 rounded-full"
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
