import { motion } from 'framer-motion'
import { BadgeCheck, ArrowRight } from 'lucide-react'
import { stats } from '../config/draco.js'

const CARDS = [
  { label: 'DOGS HELPED', value: stats.dogsHelped },
  { label: 'TREATMENTS', value: stats.treatments },
  { label: 'MEALS', value: stats.meals },
  { label: 'TOTAL IMPACT', value: `৳${stats.totalImpactBDT}` },
]

export default function DracoFund() {
  return (
    <section id="fund" className="relative bg-black py-40 px-6">
      <div className="max-w-4xl mx-auto text-center">
        <p className="mono text-[11px] tracking-[0.25em] text-white/40">THE DRACO FUND</p>
        <h2 className="mt-4 text-3xl md:text-5xl font-semibold text-[#ece7de]">
          MEMORY SHOULD CREATE SOMETHING REAL.
        </h2>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 1 }}
        className="max-w-5xl mx-auto mt-20 rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-8 md:p-12"
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {CARDS.map((c) => (
            <div key={c.label} className="text-center">
              <p className="text-4xl md:text-5xl font-semibold text-[#ece7de] mono">{c.value}</p>
              <p className="mt-2 text-[10px] tracking-[0.2em] text-white/50">{c.label}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between mt-12 pt-8 border-t border-white/10 gap-4">
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
