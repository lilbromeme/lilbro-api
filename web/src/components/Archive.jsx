import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { archiveItems } from '../config/draco.js'

export default function Archive() {
  const [open, setOpen] = useState(null)

  return (
    <section className="relative bg-black py-40 px-6">
      <p className="mono text-center text-[11px] tracking-[0.25em] text-white/40">THE ARCHIVE</p>

      <div className="max-w-4xl mx-auto mt-16 grid grid-cols-1 md:grid-cols-3 gap-4">
        {archiveItems.map((item) => (
          <motion.button
            key={item.id}
            onClick={() => setOpen(item)}
            whileHover={{ y: -4 }}
            data-cursor="view"
            className="text-left rounded-lg border border-white/10 bg-white/[0.02] p-6 hover:bg-white/[0.05] transition"
          >
            <p className="text-white/80 text-sm tracking-wide">{item.title}</p>
          </motion.button>
        ))}
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-md flex items-center justify-center p-6"
            onClick={() => setOpen(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              onClick={(e) => e.stopPropagation()}
              className="relative max-w-lg w-full rounded-xl border border-white/10 bg-[#0a0a0a] p-10 text-center"
            >
              <button
                onClick={() => setOpen(null)}
                className="absolute top-4 right-4 text-white/40 hover:text-white"
              >
                <X size={18} />
              </button>
              <h3 className="text-xl text-white/90 tracking-wide">{open.title}</h3>
              <p className="mt-4 text-white/40 text-sm">
                This section of the archive will be populated as the record grows.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
