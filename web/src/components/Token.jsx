import { motion } from 'framer-motion'
import { token } from '../config/draco.js'

const FIELDS = [
  ['NAME', token.name],
  ['SYMBOL', token.symbol],
  ['NETWORK', token.network],
  ['CONTRACT', token.contract],
  ['SUPPLY', token.supply],
]

export default function Token() {
  return (
    <section className="relative bg-black py-40 px-6">
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="text-3xl md:text-5xl font-semibold text-[#ece7de]">
          THE COMMUNITY HAS A TOKEN.
        </h2>
        <p className="mt-4 text-white/50 text-sm tracking-wide">
          THE TOKEN IS NOT THE MISSION.
          <br />
          THE MISSION IS WHY IT EXISTS.
        </p>
      </div>

      <div className="mt-20 flex flex-col md:flex-row items-center justify-center gap-16 max-w-4xl mx-auto">
        <motion.div
          animate={{ rotateY: [0, 360] }}
          transition={{ duration: 14, repeat: Infinity, ease: 'linear' }}
          style={{ transformStyle: 'preserve-3d' }}
          className="w-40 h-40 md:w-52 md:h-52 shrink-0 rounded-full border border-white/20 bg-gradient-to-br from-white/10 to-transparent backdrop-blur flex items-center justify-center shadow-[0_0_60px_rgba(255,255,255,0.08)]"
        >
          <span className="text-2xl font-semibold text-white/80 mono">$DRACO</span>
        </motion.div>

        <div className="grid grid-cols-2 gap-x-10 gap-y-6 mono text-sm w-full max-w-sm">
          {FIELDS.map(([label, value]) => (
            <div key={label}>
              <p className="text-[10px] tracking-[0.2em] text-white/35">{label}</p>
              <p className="mt-1 text-white/75">{value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-center mt-16">
        <button
          disabled={!token.launched}
          className="px-8 py-3 rounded-full border border-white/20 text-sm tracking-[0.2em] text-white/40 cursor-not-allowed"
          title="Token not yet launched"
        >
          GET $DRACO
        </button>
      </div>
    </section>
  )
}
