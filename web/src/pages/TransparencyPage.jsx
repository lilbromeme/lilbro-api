import { DRACO_CONFIG } from '../config/draco.ts'

const SECTIONS = [
  { label: 'CONTRACT', value: DRACO_CONFIG.contractAddress },
  { label: 'FUND WALLET', value: DRACO_CONFIG.fundWallet },
  { label: 'OPERATIONS WALLET', value: DRACO_CONFIG.operationsWallet },
  { label: 'LIQUIDITY', value: DRACO_CONFIG.liquidityWallet },
  {
    label: 'FEE STRUCTURE',
    value:
      DRACO_CONFIG.feeAllocation.fundPct != null
        ? `Fund ${DRACO_CONFIG.feeAllocation.fundPct}% / Ops ${DRACO_CONFIG.feeAllocation.operationsPct}% / Community ${DRACO_CONFIG.feeAllocation.communityPct}%`
        : 'PLACEHOLDER',
  },
  { label: 'TREASURY', value: 'PLACEHOLDER' },
  { label: 'DONATIONS', value: 'See /fund for live totals' },
  { label: 'DISBURSEMENTS', value: 'See /impact for published records' },
  { label: 'SMART CONTRACT', value: 'PLACEHOLDER' },
  { label: 'AUDIT / SECURITY', value: 'PLACEHOLDER' },
]

export default function TransparencyPage() {
  return (
    <div className="min-h-screen bg-[#08090a] text-[#f5f3ee] px-6 py-24">
      <div className="max-w-xl mx-auto text-center">
        <p className="mono text-[11px] tracking-[0.25em] text-white/40">TRUST CENTER</p>
        <h1 className="mt-4 text-3xl md:text-5xl font-semibold">Nothing hidden. Nothing invented.</h1>
        <p className="mt-4 text-white/50 text-sm">
          Every field below is either a confirmed, verifiable fact or explicitly
          marked PLACEHOLDER until it is.
        </p>
      </div>

      <div className="max-w-xl mx-auto mt-16 divide-y divide-white/10 border-t border-b border-white/10">
        {SECTIONS.map((s) => (
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

      <p className="max-w-xl mx-auto mt-10 text-center mono text-[10px] tracking-[0.2em] text-white/30">
        LAUNCH STATUS: {DRACO_CONFIG.launch.status}
      </p>
    </div>
  )
}
