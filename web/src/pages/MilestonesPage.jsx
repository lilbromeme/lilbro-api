import { motion } from 'framer-motion'
import { PawPrint } from 'lucide-react'
import usePublicMilestones from '../hooks/usePublicMilestones.js'

export default function MilestonesPage() {
  const { milestones, loading } = usePublicMilestones()

  return (
    <div className="min-h-screen bg-[#08090a] text-[#f5f3ee] px-6 py-24">
      <div className="max-w-xl mx-auto text-center">
        <p className="mono text-[11px] tracking-[0.25em] text-white/40">PAW MILESTONES</p>
        <h1 className="mt-4 text-3xl md:text-5xl font-semibold">One dog started this.</h1>
        <p className="mt-3 text-white/50 text-sm">
          Every milestone below is real — marked achieved only when the
          database recorded the qualifying event.
        </p>
      </div>

      <div className="max-w-xl mx-auto mt-16">
        {!loading && milestones.length === 0 && (
          <div className="text-center border border-dashed border-white/10 rounded-xl py-16 px-6">
            <PawPrint size={20} strokeWidth={1.2} className="mx-auto text-white/30" />
            <p className="mt-4 mono text-[11px] tracking-[0.2em] text-white/40">NO MILESTONES REACHED YET.</p>
          </div>
        )}

        <div className="space-y-4">
          {milestones.map((m, i) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{ duration: 0.5, delay: i * 0.05 }}
              className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-5"
            >
              <PawPrint size={18} strokeWidth={1.3} className="text-white/70 shrink-0" />
              <div>
                <p className="mono text-[11px] tracking-[0.2em] text-white/80">{m.title}</p>
                <p className="text-white/45 text-sm mt-1">{m.description}</p>
                <p className="mono text-[9px] tracking-[0.15em] text-white/30 mt-1">
                  {new Date(m.achieved_at).toLocaleDateString()}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}
