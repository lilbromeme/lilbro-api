import { motion } from 'framer-motion'
import { BadgeCheck, ArrowRight } from 'lucide-react'
import { stats } from '../config/draco.js'

const CARDS = [
  { label: 'DOGS HELPED', value: stats.dogsHelped },
  { label: 'TREATMENTS', value: stats.treatments },
  { label: 'MEALS', value: stats.meals },
  { label: 'TOTAL IMPACT', value: `৳${stats.totalImpactBDT}` },
]

const allZero = Object.values(stats).every((v) => !v)

export default function DracoFund() {
  return (
    <section
      id="fund"
      className="relative py-20 md:py-32 px-6"
      style={{ background: 'linear-gradient(180deg, #191b1e 0%, #202226 100%)' }}
    >
      <div className="max-w-4xl mx-auto text-center">
        <p className="mono text-[11px] tracking-[0.25em] text-[var(--accent-blue)]">THE DRACO FUND</p>
        <h2 className="mt-4 text-3xl md:text-5xl font-semibold text-[#f5f3ee]">
          TRANSPARENT BY DESIGN.
        </h2>
        <p className="mt-3 text-white/50 text-sm">MEMORY SHOULD CREATE SOMETHING REAL.</p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 1 }}
        className="max-w-5xl mx-auto mt-16 rounded-2xl border border-white/10 bg-white/[0.05] backdrop-blur-xl p-8 md:p-12"
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {CARDS.map((c) => (
            <div key={c.label} className="text-center">
              <p className="text-4xl md:text-5xl font-semibold text-[#f5f3ee] mono">{c.value}</p>
              <p className="mt-2 text-[10px] tracking-[0.2em] text-white/50">{c.label}</p>
            </div>
          ))}
        </div>

        {/* animated placeholder line/graph */}
        <div className="mt-10 h-16 relative overflow-hidden rounded-lg border border-white/5 bg-white/[0.02]">
          <motion.div
            className="absolute inset-y-0 left-0 w-full"
            style={{
              background:
                'repeating-linear-gradient(90deg, transparent 0, transparent 18px, rgba(143,164,184,0.15) 19px, transparent 20px)',
            }}
            animate={{ x: [0, -40] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
          />
          {allZero && (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="mono text-[10px] tracking-[0.2em] text-white/40">
                THE FIRST CHAPTER HASN'T BEEN WRITTEN YET.
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between mt-10 pt-8 border-t border-white/10 gap-4">
          <div className="flex items-center gap-2 text-white/60">
            <BadgeCheck size={16} strokeWidth={1.4} />
            <span className="mono text-[11px] tracking-[0.15em]">VERIFIED IMPACT ONLY</span>
          </div>
          <a
            href="#impact-ledger"
            data-cursor="view"
            className="flex items-center gap-2 text-sm tracking-wide text-white/80 hover:text-white transition"
          >
            VIEW IMPACT LEDGER <ArrowRight size={14} />
          </a>
        </div>
      </motion.div>
    </section>
  )
}
