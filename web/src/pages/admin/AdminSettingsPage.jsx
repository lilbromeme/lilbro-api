import { useEffect, useState } from 'react'
import { DRACO_CONFIG } from '../../config/draco.ts'
import { callAdminFunction } from '../../lib/adminApi.js'
import useAdminSession from '../../hooks/useAdminSession.js'
import AdminLogin from './AdminLogin.jsx'
import AdminShell from '../../components/admin/AdminShell.jsx'
import StatusPill from '../../components/admin/StatusPill.jsx'

// This page NEVER displays a secret value — only which config fields are
// set (PLACEHOLDER vs real) and, for server-side integrations, whether
// they're configured (via system-health, which itself only returns
// booleans, never the secret). Real values live in .env.example /
// platform secret managers; changing them requires a deploy, not a form
// submission here — see docs/SECURITY.md on why there is no "paste your
// private key" field anywhere in this app.

export default function AdminSettingsPage() {
  const { session, isAdmin, loading } = useAdminSession()
  const [health, setHealth] = useState(null)

  useEffect(() => {
    if (isAdmin) callAdminFunction('system-health').then(setHealth).catch(() => {})
  }, [isAdmin])

  if (loading) return null
  if (!session) return <AdminLogin />
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#0b0c0e] text-white/60 flex items-center justify-center">
        This account does not have admin access.
      </div>
    )
  }

  return (
    <AdminShell title="CONFIGURATION CENTER">
      <div className="space-y-10 max-w-3xl">
        <Section title="TOKEN">
          <Field label="Network" value={DRACO_CONFIG.network} />
          <Field label="Contract" value={DRACO_CONFIG.contractAddress} />
          <Field label="Explorer" value={DRACO_CONFIG.explorerBaseUrl} />
          <Field
            label="Fee allocation"
            value={
              DRACO_CONFIG.feeAllocation.fundPct != null
                ? `Fund ${DRACO_CONFIG.feeAllocation.fundPct}% / Ops ${DRACO_CONFIG.feeAllocation.operationsPct}% / Community ${DRACO_CONFIG.feeAllocation.communityPct}%`
                : 'PLACEHOLDER'
            }
          />
        </Section>

        <Section title="TREASURY">
          <Field label="Fund wallet" value={DRACO_CONFIG.fundWallet} />
          <Field label="Operations wallet" value={DRACO_CONFIG.operationsWallet} />
          <Field label="Liquidity wallet" value={DRACO_CONFIG.liquidityWallet} />
          <div className="flex items-center justify-between py-2">
            <span className="mono text-[11px] tracking-[0.15em] text-white/50">Multisig configuration</span>
            <StatusPill status={health?.treasury ?? 'not_configured'} />
          </div>
        </Section>

        <Section title="DONATIONS">
          <div className="flex items-center justify-between py-2">
            <span className="mono text-[11px] tracking-[0.15em] text-white/50">Crypto provider</span>
            <StatusPill status={DRACO_CONFIG.donations.cryptoEnabled ? 'connected' : 'not_configured'} />
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="mono text-[11px] tracking-[0.15em] text-white/50">Card provider</span>
            <StatusPill status={DRACO_CONFIG.donations.cardEnabled ? 'connected' : 'not_configured'} />
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="mono text-[11px] tracking-[0.15em] text-white/50">Webhook status</span>
            <StatusPill status={health?.donation_provider ?? 'not_configured'} />
          </div>
        </Section>

        <Section title="COMMUNITY">
          <div className="flex items-center justify-between py-2">
            <span className="mono text-[11px] tracking-[0.15em] text-white/50">Telegram</span>
            <StatusPill status={health?.telegram ?? 'not_configured'} />
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="mono text-[11px] tracking-[0.15em] text-white/50">Discord</span>
            <StatusPill status={health?.discord ?? 'not_configured'} />
          </div>
          <Field label="X" value={DRACO_CONFIG.social.x} />
        </Section>

        <Section title="IMPACT">
          <Field label="Milestone settings" value="Defined in the milestones table — see /admin" />
          <Field label="Verification requirements" value="Manual admin verification per case (see /admin/cases)" />
        </Section>

        <p className="mono text-[10px] tracking-[0.15em] text-white/25">
          ALL SENSITIVE CREDENTIALS ARE SERVER-SIDE ONLY. NOTHING ON THIS PAGE CAN DISPLAY OR ACCEPT A SECRET.
        </p>
      </div>
    </AdminShell>
  )
}

function Section({ title, children }) {
  return (
    <div>
      <p className="mono text-[11px] tracking-[0.2em] text-white/40 mb-3">{title}</p>
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 divide-y divide-white/5">{children}</div>
    </div>
  )
}

function Field({ label, value }) {
  return (
    <div className="flex items-center justify-between py-2 gap-6">
      <span className="mono text-[11px] tracking-[0.15em] text-white/50">{label}</span>
      <span className={`mono text-[12px] text-right break-all ${value === 'PLACEHOLDER' ? 'text-white/30' : 'text-white/85'}`}>
        {value}
      </span>
    </div>
  )
}
