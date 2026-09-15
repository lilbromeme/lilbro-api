import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { BadgeCheck } from 'lucide-react'
import usePublicFund from '../hooks/usePublicFund.js'
import { isDemoMode } from '../lib/demoMode.ts'
import { DRACO_CONFIG } from '../config/draco.ts'

function usd(n) {
  return `$${Number(n ?? 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}`
}

export default function FundPage() {
  const { summary, loading } = usePublicFund()

  const rows = [
    { label: 'TOKEN FEES', value: summary.token_fees_usd },
    { label: 'DIRECT DONATIONS', value: summary.direct_donations_usd },
    { label: '$DRACO DONATIONS', value: summary.draco_donations_usd },
    { label: 'DISBURSED', value: summary.disbursed_usd },
    { label: 'AVAILABLE', value: summary.available_usd },
  ]

  return (
    <div className="min-h-screen bg-[#08090a] text-[#f5f3ee] px-6 py-24">
      <div className="max-w-3xl mx-auto text-center">
        <p className="mono text-[11px] tracking-[0.25em] text-[#8fa4b8]">DRACO FUND</p>
        <p className="mono text-[11px] tracking-[0.2em] text-white/40 mt-2">TOTAL GENERATED</p>
        <motion.h1
          key={summary.total_generated_usd}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-6xl md:text-8xl font-semibold mt-2"
        >
          {loading ? '—' : usd(summary.total_generated_usd)}
        </motion.h1>
      </div>

      <div className="max-w-3xl mx-auto mt-16 grid grid-cols-2 md:grid-cols-5 gap-6">
        {rows.map((r) => (
          <div key={r.label} className="text-center">
            <p className="text-2xl md:text-3xl font-semibold mono">{loading ? '—' : usd(r.value)}</p>
            <p className="mt-2 text-[10px] tracking-[0.2em] text-white/45">{r.label}</p>
          </div>
        ))}
      </div>

      <div className="max-w-3xl mx-auto mt-16 flex flex-col items-center gap-3 text-white/50">
        <div className="flex items-center gap-2">
          <BadgeCheck size={16} strokeWidth={1.4} />
          <span className="mono text-[11px] tracking-[0.15em]">LIVE ON-CHAIN DATA</span>
        </div>
        {DRACO_CONFIG.network === 'PLACEHOLDER' ? (
          <p className="mono text-[10px] tracking-[0.15em] text-white/30">
            NETWORK NOT YET CONFIGURED — EXPLORER LINKS WILL APPEAR HERE
          </p>
        ) : (
          <a
            href={DRACO_CONFIG.explorerBaseUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm underline decoration-white/20 hover:decoration-white/60"
          >
            View on {DRACO_CONFIG.network} explorer
          </a>
        )}
      </div>

      <div className="text-center mt-20">
        <Link to="/impact" className="mono text-[11px] tracking-[0.2em] text-white/60 hover:text-white transition">
          VIEW IMPACT LEDGER →
        </Link>
      </div>

      {isDemoMode && (
        <p className="text-center mt-10 mono text-[10px] tracking-[0.2em] text-amber-400">
          SHOWING DEMO DATA
        </p>
      )}
    </div>
  )
}
