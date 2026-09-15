import { motion } from 'framer-motion'
import { ledgerEntries, milestones } from '../config/draco.js'

export default function ImpactLedger() {
  return (
    <section
      id="impact-ledger"
      className="relative py-20 md:py-32 px-6"
      style={{ background: 'linear-gradient(180deg, #202226 0%, #26282c 100%)' }}
    >
      <p className="mono text-center text-[11px] tracking-[0.25em] text-white/40">
        IMPACT LEDGER // ARCHIVE
      </p>

      <div className="max-w-lg mx-auto mt-16 relative">
        <div className="absolute left-4 top-2 bottom-2 w-px bg-white/10" />
        {milestones.map((m, i) => (
          <motion.div
            key={m.id}
            initial={{ opacity: 0, x: -12 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 0.6, delay: i * 0.08 }}
            className="relative pl-12 pb-10"
          >
            <span className="absolute left-[10px] top-1 w-2.5 h-2.5 rounded-full border border-white/25 bg-[#26282c]" />
            <p className="mono text-[11px] tracking-[0.2em] text-white/60">{m.id} — {m.title}</p>
            <p className="mt-1 text-white/35 text-xs tracking-[0.15em] mono">WAITING TO BE WRITTEN</p>
          </motion.div>
        ))}
      </div>

      <div className="max-w-2xl mx-auto mt-16 relative">
        <div className="absolute left-4 top-0 bottom-0 w-px bg-white/10" />
        {ledgerEntries.map((entry, i) => (
          <motion.div
            key={entry.id}
            initial={{ opacity: 0, x: -16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.8, delay: i * 0.1 }}
            className="relative pl-12 pb-16"
          >
            <span className="absolute left-[10px] top-1.5 w-2.5 h-2.5 rounded-full bg-white/60 shadow-[0_0_10px_rgba(255,255,255,0.4)]" />
            <p className="mono text-[11px] tracking-[0.2em] text-white/50">
              DRACO FUND // {entry.id}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
              <Field label="STATUS" value={entry.status} />
              <Field label="DOG" value={entry.dog} />
              <Field label="LOCATION" value={entry.location} />
              <Field label="PURPOSE" value={entry.purpose} />
              <Field label="AMOUNT" value={entry.amount} />
              <Field label="TRANSACTION" value={entry.tx} />
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  )
}

function Field({ label, value }) {
  return (
    <div>
      <p className="text-[10px] tracking-[0.2em] text-white/35">{label}</p>
      <p className="mt-1 text-white/75 mono text-[13px]">{value}</p>
    </div>
  )
}
