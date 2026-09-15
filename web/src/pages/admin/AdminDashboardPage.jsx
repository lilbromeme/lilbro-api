import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient.ts'
import useAdminSession from '../../hooks/useAdminSession.js'
import AdminLogin from './AdminLogin.jsx'
import AdminShell from '../../components/admin/AdminShell.jsx'
import SystemHealthPanel from '../../components/admin/SystemHealthPanel.jsx'
import ActivityStream from '../../components/admin/ActivityStream.jsx'

export default function AdminDashboardPage() {
  const { session, isAdmin, loading } = useAdminSession()
  const [fund, setFund] = useState(null)
  const [caseCounts, setCaseCounts] = useState(null)
  const [dogsHelped, setDogsHelped] = useState(null)

  useEffect(() => {
    if (!isAdmin) return

    supabase.from('public_fund_summary').select('*').maybeSingle().then(({ data }) => setFund(data))

    supabase
      .from('impact_reports')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'PUBLISHED')
      .then(({ count }) => setDogsHelped(count ?? 0))

    supabase
      .from('cases')
      .select('verification_status, approval_status, stage')
      .then(({ data }) => {
        if (!data) return
        setCaseCounts({
          pending: data.filter((c) => c.verification_status === 'PENDING').length,
          total: data.length,
        })
      })
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
    <AdminShell>
      <div className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">DRACO CONTROL</h1>
          <p className="mono text-[10px] tracking-[0.2em] text-emerald-400 mt-1">● SYSTEM ONLINE</p>
        </div>
        <Link to="/admin/cases" className="btn-admin">
          Manage Cases →
        </Link>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-10">
        <DashboardCard title="FUND">
          <BigStat label="TOTAL FUND" value={fund?.total_generated_usd} />
          <div className="grid grid-cols-2 gap-4 mt-4">
            <Stat label="TOKEN FEE ALLOCATION" value={fund?.token_fees_usd} />
            <Stat label="DIRECT DONATIONS" value={fund?.direct_donations_usd} />
            <Stat label="$DRACO DONATIONS" value={fund?.draco_donations_usd} />
            <Stat label="DISBURSED" value={fund?.disbursed_usd} />
          </div>
        </DashboardCard>

        <DashboardCard title="CASES & IMPACT">
          <div className="grid grid-cols-2 gap-4">
            <Stat label="PENDING CASES" value={caseCounts?.pending} money={false} />
            <Stat label="TOTAL CASES" value={caseCounts?.total} money={false} />
            <Stat label="DOGS HELPED" value={dogsHelped} money={false} />
            <Stat label="AVAILABLE" value={fund?.available_usd} />
          </div>
        </DashboardCard>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <SystemHealthPanel />
        <ActivityStream />
      </div>
    </AdminShell>
  )
}

function DashboardCard({ title, children }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
      <p className="mono text-[11px] tracking-[0.2em] text-white/40 mb-4">{title}</p>
      {children}
    </div>
  )
}

function BigStat({ label, value }) {
  const display = value == null ? '—' : `$${Number(value).toLocaleString()}`
  return (
    <div>
      <p className="text-4xl font-semibold mono">{display}</p>
      <p className="mt-1 text-[10px] tracking-[0.15em] text-white/45">{label}</p>
    </div>
  )
}

function Stat({ label, value, money = true }) {
  const display = value == null ? '—' : money ? `$${Number(value).toLocaleString()}` : value
  return (
    <div>
      <p className="text-xl font-semibold mono">{display}</p>
      <p className="mt-1 text-[9px] tracking-[0.15em] text-white/40">{label}</p>
    </div>
  )
}
