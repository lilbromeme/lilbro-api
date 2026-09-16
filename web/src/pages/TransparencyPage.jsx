import { Link } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { DRACO_CONFIG } from '../config/draco.ts'
import usePublicFund from '../hooks/usePublicFund.js'

function usd(n) {
  return `$${Number(n ?? 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}`
}

export default function TransparencyPage() {
  const { summary, loading } = usePublicFund()

  const staticSections = [
    { label: 'CONTRACT', value: DRACO_CONFIG.contractAddress },
    { label: 'FUND', value: DRACO_CONFIG.fundWallet },
    { label: 'TREASURY', value: DRACO_CONFIG.operationsWallet },
    {
      label: 'FEE ROUTING',
      value:
        DRACO_CONFIG.feeAllocation.fundPct != null
          ? `Fund ${DRACO_CONFIG.feeAllocation.fundPct}% / Ops ${DRACO_CONFIG.feeAllocation.operationsPct}% / Community ${DRACO_CONFIG.feeAllocation.communityPct}%`
          : 'PLACEHOLDER',
    },
    { label: 'LIQUIDITY', value: DRACO_CONFIG.liquidityWallet },
    { label: 'SMART CONTRACT', value: 'PLACEHOLDER' },
    { label: 'AUDIT / SECURITY', value: 'PLACEHOLDER' },
  ]

  const liveSections = [
    { label: 'DONATIONS', value: loading ? '—' : usd(summary.direct_donations_usd + summary.draco_donations_usd) },
    { label: 'DISBURSEMENTS', value: loading ? '—' : usd(summary.disbursed_usd) },
    { label: 'IMPACT', value: 'See /impact for the full published ledger' },
  ]

  return (
    <div className="min-h-screen bg-[#08090a] text-[#f5f3ee] px-6 py-24">
      <div className="max-w-xl mx-auto text-center">
        <p className="mono text-[11px] tracking-[0.25em] text-white/40">TRUST CENTER</p>
        <h1 className="mt-4 text-3xl md:text-5xl font-semibold">Nothing hidden. Nothing invented.</h1>
        <p className="mt-4 text-white/50 text-sm">
          Every field below is either a confirmed, verifiable fact, a live
          database-derived total, or explicitly marked PLACEHOLDER until it
          is real.
        </p>
      </div>

      <div className="max-w-xl mx-auto mt-16">
        <p className="mono text-[10px] tracking-[0.2em] text-white/35 mb-3">CHAIN & TREASURY FACTS</p>
        <div className="divide-y divide-white/10 border-t border-b border-white/10">
          {staticSections.map((s) => (
            <div key={s.label} className="flex items-center justify-between gap-6 py-5">
              <span className="mono text-[11px] tracking-[0.15em] text-white/50">{s.label}</span>
              <span
                className={`mono text-[13px] text-right break-all ${
                  s.value === 'PLACEHOLDER' ? 'text-white/30' : 'text-white/85'
                }`}
              >
                {s.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-xl mx-auto mt-12">
        <p className="mono text-[10px] tracking-[0.2em] text-white/35 mb-3">LIVE, VERIFIED FIGURES</p>
        <div className="divide-y divide-white/10 border-t border-b border-white/10">
          {liveSections.map((s) => (
            <div key={s.label} className="flex items-center justify-between gap-6 py-5">
              <span className="mono text-[11px] tracking-[0.15em] text-white/50">{s.label}</span>
              <span className="mono text-[13px] text-right text-white/85">{s.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-xl mx-auto mt-14 flex flex-col items-center gap-4">
        <div className="flex items-center gap-2 text-white/60">
          <ShieldCheck size={16} strokeWidth={1.4} />
          <span className="mono text-[11px] tracking-[0.2em]">VERIFY EVERYTHING</span>
        </div>
        <p className="text-white/40 text-xs text-center max-w-sm">
          Don't trust the website — verify the system. Every fund figure
          traces to a confirmed database record; every disbursement links
          to its on-chain transaction once the network is live.
        </p>
        <div className="flex gap-6 mt-2">
          <Link to="/fund" className="mono text-[11px] tracking-[0.15em] text-white/60 hover:text-white underline">
            LIVE FUND →
          </Link>
          <Link to="/impact" className="mono text-[11px] tracking-[0.15em] text-white/60 hover:text-white underline">
            IMPACT LEDGER →
          </Link>
          <Link to="/milestones" className="mono text-[11px] tracking-[0.15em] text-white/60 hover:text-white underline">
            MILESTONES →
          </Link>
        </div>
      </div>

      <p className="max-w-xl mx-auto mt-14 text-center mono text-[10px] tracking-[0.2em] text-white/30">
        LAUNCH STATUS: {DRACO_CONFIG.launch.status}
      </p>
    </div>
  )
}
