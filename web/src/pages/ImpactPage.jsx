import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { PawPrint } from 'lucide-react'
import usePublicImpact from '../hooks/usePublicImpact.js'

export default function ImpactPage() {
  const { records, loading } = usePublicImpact()

  return (
    <div className="min-h-screen bg-[#08090a] text-[#f5f3ee] px-6 py-24">
      <div className="max-w-2xl mx-auto text-center">
        <p className="mono text-[11px] tracking-[0.25em] text-white/40">IMPACT LEDGER</p>
        <h1 className="mt-4 text-3xl md:text-5xl font-semibold">Every dollar, traced.</h1>
      </div>

      <div className="max-w-2xl mx-auto mt-20">
        {!loading && records.length === 0 && (
          <div className="text-center border border-dashed border-white/10 rounded-xl py-20 px-6">
            <PawPrint size={22} strokeWidth={1.2} className="mx-auto text-white/30" />
            <p className="mt-4 mono text-[11px] tracking-[0.2em] text-white/40">
              THE FIRST CHAPTER HASN'T BEEN WRITTEN YET.
            </p>
          </div>
        )}

        <div className="space-y-10">
          {records.map((r, i) => (
            <motion.div
              key={r.report_id}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.6 }}
              className="rounded-xl border border-white/10 bg-white/[0.03] p-6"
            >
              <p className="mono text-[11px] tracking-[0.2em] text-white/50">
                DRACO IMPACT #{String(records.length - i).padStart(3, '0')}
              </p>
              <div className="grid grid-cols-2 gap-y-4 gap-x-8 mt-4 text-sm">
                <Field label="DOG" value={r.dog_name} />
                <Field label="LOCATION" value={r.dog_location} />
                <Field label="PURPOSE" value={r.title} />
                <Field label="AMOUNT" value={r.amount_spent ? `$${r.amount_spent}` : '—'} />
                <Field label="STATUS" value="COMPLETED" />
                <Field
                  label="TRANSACTION"
                  value={
                    r.tx_hash ? (
                      <Link to={`/tx/${r.tx_hash}`} className="underline decoration-white/30">
                        VIEW TRANSACTION →
                      </Link>
                    ) : (
                      '—'
                    )
                  }
                />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Field({ label, value }) {
  return (
    <div>
      <p className="text-[10px] tracking-[0.2em] text-white/35">{label}</p>
      <p className="mt-1 text-white/80 mono text-[13px]">{value ?? '—'}</p>
    </div>
  )
}
