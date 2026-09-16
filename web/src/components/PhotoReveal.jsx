import { motion } from 'framer-motion'

// Photographs feel alive as they enter the viewport: soft blur/scale settle into focus.
export default function PhotoReveal({ src, alt, className = '', imgClassName = '', glow = false }) {
  return (
    <motion.div
      initial={{ opacity: 0.7, filter: 'blur(8px)', scale: 1.03 }}
      whileInView={{ opacity: 1, filter: 'blur(0px)', scale: 1 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 1, ease: 'easeOut' }}
      className={`relative overflow-hidden rounded-2xl border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.5)] ${className}`}
      data-cursor="view"
    >
      {glow && (
        <div className="absolute -inset-10 -z-10 bg-[radial-gradient(circle,rgba(197,184,165,0.18),transparent_65%)]" />
      )}
      <img src={src} alt={alt} loading="lazy" className={`w-full h-full object-cover ${imgClassName}`} />
    </motion.div>
  )
}
