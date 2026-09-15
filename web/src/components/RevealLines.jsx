import { motion } from 'framer-motion'

// Scroll-triggered sequential typography lines.
export default function RevealLines({ lines, className = '', lineClassName = '' }) {
  return (
    <div className={className}>
      {lines.map((line, i) => (
        <motion.p
          key={i}
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.9, delay: i * 0.25 }}
          className={lineClassName}
        >
          {line}
        </motion.p>
      ))}
    </div>
  )
}
