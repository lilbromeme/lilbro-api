import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient.ts'
import { DRACO_CONFIG } from '../config/draco.ts'

export default function TransactionDetailPage() {
  const { txHash } = useParams()
  const [tx, setTx] = useState(undefined)

  useEffect(() => {
    supabase
      .from('public_treasury_feed')
      .select('*')
      .eq('tx_hash', txHash)
      .maybeSingle()
      .then(({ data }) => setTx(data ?? null))
      .catch(() => setTx(null))
  }, [txHash])

  const explorerUrl =
    tx && DRACO_CONFIG.explorerBaseUrl !== 'PLACEHOLDER' ? `${DRACO_CONFIG.explorerBaseUrl}${tx.tx_hash}` : null

  return (
    <div className="min-h-screen bg-[#08090a] text-[#f5f3ee] px-6 py-24">
      <div className="max-w-xl mx-auto">
        <Link to="/fund" className="mono text-[10px] tracking-[0.15em] text-white/40 hover:text-white/70">
          ← BACK TO FUND
        </Link>

        <p className="mono text-[11px] tracking-[0.25em] text-white/40 mt-8">TRANSACTION</p>

        {tx === undefined && <p className="text-white/40 mt-6">Loading…</p>}
        {tx === null && (
          <p className="text-white/40 mt-6">
            No public transaction record found for this hash. Only confirmed treasury transactions are shown here.
          </p>
        )}

        {tx && (
          <div className="mt-8 rounded-xl border border-white/10 bg-white/[0.03] p-6 space-y-4">
            <Field label="TRANSACTION HASH" value={tx.tx_hash} />
            <Field label="NETWORK" value={tx.network} />
            <Field label="ASSET" value={tx.asset} />
            <Field label="AMOUNT" value={tx.amount} />
            <Field label="USD VALUE" value={tx.usd_value ? `$${tx.usd_value}` : '—'} />
            <Field label="TIMESTAMP" value={new Date(tx.created_at).toLocaleString()} />
            <Field label="DIRECTION" value={tx.direction} />
            <Field label="CATEGORY" value={tx.category} />
            <Field label="STATUS" value="CONFIRMED" />
            {explorerUrl ? (
              <a href={explorerUrl} target="_blank" rel="noreferrer" className="inline-block mt-2 underline text-sm">
                VIEW ON CHAIN →
              </a>
            ) : (
              <p className="mono text-[10px] tracking-[0.15em] text-white/30">
                EXPLORER LINK UNAVAILABLE — NETWORK NOT YET CONFIGURED
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function Field({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-6">
      <span className="mono text-[10px] tracking-[0.15em] text-white/40">{label}</span>
      <span className="mono text-[13px] text-white/85 text-right break-all">{value ?? '—'}</span>
    </div>
  )
}
