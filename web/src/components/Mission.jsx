import { motion } from 'framer-motion'
import { PawPrint, HeartPulse, Stethoscope, Home } from 'lucide-react'

const ORBIT = [
  { icon: PawPrint, label: 'RESCUE' },
  { icon: HeartPulse, label: 'CARE' },
  { icon: Stethoscope, label: 'MEDICAL' },
  { icon: Home, label: 'SHELTER' },
]

export default function Mission() {
  return (
    <section
      id="mission"
      className="relative py-48 px-6 overflow-hidden"
      style={{ background: 'radial-gradient(ellipse at 50% 30%, #1a1712 0%, #050505 65%)' }}
    >
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 1 }}
        className="text-center text-2xl md:text-4xl font-medium text-[#ece7de] max-w-2xl mx-auto"
      >
        SO WE BUILT SOMETHING IN HER NAME.
      </motion.h2>

      <div className="relative mt-28 flex items-center justify-center h-[420px]">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.2 }}
          className="text-center z-10"
        >
          <h3 className="text-6xl md:text-8xl font-semibold text-[#ece7de]">DRACO</h3>
          <p className="mono mt-3 text-[11px] tracking-[0.2em] text-white/50">
            A COMMUNITY FOR DOGS THAT STILL NEED SOMEONE.
          </p>
        </motion.div>

        <div className="absolute inset-0 hidden md:block">
          {ORBIT.map((item, i) => {
            const angle = (i / ORBIT.length) * Math.PI * 2
            const radius = 230
            const x = Math.cos(angle) * radius
            const y = Math.sin(angle) * radius
            const Icon = item.icon
            return (
              <motion.div
                key={item.label}
                className="absolute top-1/2 left-1/2 flex flex-col items-center gap-2"
                style={{ x, y, translateX: '-50%', translateY: '-50%' }}
                animate={{ y: [y, y - 10, y] }}
                transition={{ duration: 4 + i, repeat: Infinity, ease: 'easeInOut' }}
              >
                <div className="w-14 h-14 rounded-full border border-white/15 flex items-center justify-center bg-white/5 backdrop-blur">
                  <Icon size={20} strokeWidth={1.2} className="text-white/80" />
                </div>
                <span className="mono text-[10px] tracking-[0.2em] text-white/50">{item.label}</span>
              </motion.div>
            )
          })}
        </div>

        {/* mobile: static grid */}
        <div className="md:hidden absolute -bottom-10 grid grid-cols-2 gap-8">
          {ORBIT.map((item) => {
            const Icon = item.icon
            return (
              <div key={item.label} className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-full border border-white/15 flex items-center justify-center bg-white/5">
                  <Icon size={18} strokeWidth={1.2} className="text-white/80" />
                </div>
                <span className="mono text-[10px] tracking-[0.2em] text-white/50">{item.label}</span>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
