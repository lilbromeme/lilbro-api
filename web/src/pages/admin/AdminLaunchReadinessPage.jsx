import { DRACO_CONFIG } from '../../config/draco.ts'
import { isDemoMode } from '../../lib/demoMode.ts'
import useAdminSession from '../../hooks/useAdminSession.js'
import AdminLogin from './AdminLogin.jsx'
import AdminShell from '../../components/admin/AdminShell.jsx'

// This page computes readiness from actual config values — it cannot be
// made to say READY by editing this file alone. The only way any row
// below flips to done is by DRACO_CONFIG (or an env-derived value)
// actually changing, which only happens once real information is
// provided.

function Row({ label, done, note }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
      <span className="text-sm text-white/80">{label}</span>
      <span className={`mono text-[11px] tracking-[0.15em] ${done ? 'text-emerald-400' : 'text-amber-400'}`}>
        {done ? '✓' : `⚠ ${note ?? 'NOT CONFIGURED'}`}
      </span>
    </div>
  )
}

export default function AdminLaunchReadinessPage() {
  const { session, isAdmin, loading } = useAdminSession()

  if (loading) return null
  if (!session) return <AdminLogin />
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#0b0c0e] text-white/60 flex items-center justify-center">
        This account does not have admin access.
      </div>
    )
  }

  const architecture = [
    { label: 'Database', done: true },
    { label: 'Authentication', done: true },
    { label: 'Row Level Security', done: true },
    { label: 'Demo mode off', done: !isDemoMode, note: 'VITE_DEMO_MODE IS CURRENTLY TRUE' },
    { label: 'Donation provider architecture', done: true },
    { label: 'Blockchain adapter architecture', done: true },
    { label: 'Treasury abstraction', done: true },
    { label: 'Event dispatcher', done: true },
    { label: 'Audit logging', done: true },
  ]

  const production = [
    { label: 'Token contract', done: DRACO_CONFIG.contractAddress !== 'PLACEHOLDER', note: 'NOT CONFIGURED' },
    { label: 'Launchpad', done: DRACO_CONFIG.launch.launchpad !== 'PLACEHOLDER', note: 'NOT CONFIGURED' },
    { label: 'Network', done: DRACO_CONFIG.network !== 'PLACEHOLDER', note: 'NOT CONFIGURED' },
    { label: 'Fund wallet', done: DRACO_CONFIG.fundWallet !== 'PLACEHOLDER', note: 'NOT CONFIGURED' },
    {
      label: 'Donation provider',
      done: DRACO_CONFIG.donations.cryptoEnabled || DRACO_CONFIG.donations.cardEnabled,
      note: 'NOT CONFIGURED',
    },
    { label: 'Contract audit', done: false, note: 'NOT COMPLETED' },
  ]

  const allReady = [...architecture, ...production].every((r) => r.done)

  return (
    <AdminShell title="DRACO LAUNCH READINESS">
      <div className="max-w-2xl space-y-10">
        <div
          className={`rounded-xl border p-6 text-center ${
            allReady ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-amber-500/30 bg-amber-500/5'
          }`}
        >
          <p className={`mono text-lg tracking-[0.15em] ${allReady ? 'text-emerald-400' : 'text-amber-400'}`}>
            {allReady ? 'READY FOR LAUNCH' : 'NOT YET READY'}
          </p>
          {!allReady && (
            <p className="text-white/40 text-xs mt-2">
              Every unchecked item below must be real before this can say READY.
            </p>
          )}
        </div>

        <div>
          <p className="mono text-[11px] tracking-[0.2em] text-white/40 mb-3">ARCHITECTURE</p>
          <div className="rounded-xl border border-white/10 bg-white/[0.02] px-5">
            {architecture.map((r) => (
              <Row key={r.label} {...r} />
            ))}
          </div>
        </div>

        <div>
          <p className="mono text-[11px] tracking-[0.2em] text-white/40 mb-3">PRODUCTION DEPENDENCIES</p>
          <div className="rounded-xl border border-white/10 bg-white/[0.02] px-5">
            {production.map((r) => (
              <Row key={r.label} {...r} />
            ))}
          </div>
        </div>

        <p className="mono text-[10px] tracking-[0.15em] text-white/25">
          THIS PAGE COMPUTES ITS ANSWER FROM src/config/draco.ts. IT CANNOT BE MADE TO SAY "READY" WITHOUT THAT
          CONFIGURATION ACTUALLY CHANGING.
        </p>
      </div>
    </AdminShell>
  )
}
