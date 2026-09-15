import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient.ts'
import useAdminSession from '../../hooks/useAdminSession.js'
import AdminLogin from './AdminLogin.jsx'

export default function AdminDashboardPage() {
  const { session, isAdmin, loading } = useAdminSession()
  const [fund, setFund] = useState(null)
  const [caseCounts, setCaseCounts] = useState(null)
  const [community, setCommunity] = useState(null)

  useEffect(() => {
    if (!isAdmin) return
    supabase.from('public_fund_summary').select('*').maybeSingle().then(({ data }) => setFund(data))
    supabase.from('public_community_summary').select('*').maybeSingle().then(({ data }) => setCommunity(data))

    Promise.all(
      ['PENDING', 'PENDING', 'APPROVED', 'PUBLISHED'].map((_, i) => i)
    )
    supabase
      .from('cases')
      .select('approval_status, verification_status')
      .then(({ data }) => {
        if (!data) return
        setCaseCounts({
          pending: data.filter((c) => c.verification_status === 'PENDING').length,
          verification: data.filter((c) => c.verification_status === 'VERIFIED' && c.approval_status === 'PENDING').length,
          approved: data.filter((c) => c.approval_status === 'APPROVED').length,
          total: data.length,
        })
      })
  }, [isAdmin])

  if (loading) return null
  if (!session) return <AdminLogin />
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#08090a] text-white/60 flex items-center justify-center">
        This account does not have admin access.
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#08090a] text-[#f5f3ee] px-6 py-16">
      <div className="max-w-5xl mx-auto space-y-16">
        <div>
          <p className="mono text-[11px] tracking-[0.25em] text-white/40 mb-4">FUND</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <Stat label="TOTAL FUND" value={fund?.total_generated_usd} />
            <Stat label="TOKEN FEES" value={fund?.token_fees_usd} />
            <Stat label="DIRECT DONATIONS" value={fund?.direct_donations_usd} />
            <Stat label="$DRACO DONATIONS" value={fund?.draco_donations_usd} />
            <Stat label="DISBURSED" value={fund?.disbursed_usd} />
            <Stat label="AVAILABLE" value={fund?.available_usd} />
          </div>
        </div>

        <div>
          <p className="mono text-[11px] tracking-[0.25em] text-white/40 mb-4">CASES</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <Stat label="PENDING VERIFICATION" value={caseCounts?.pending} money={false} />
            <Stat label="AWAITING APPROVAL" value={caseCounts?.verification} money={false} />
            <Stat label="APPROVED" value={caseCounts?.approved} money={false} />
            <Stat label="TOTAL" value={caseCounts?.total} money={false} />
          </div>
        </div>

        <div>
          <p className="mono text-[11px] tracking-[0.25em] text-white/40 mb-4">COMMUNITY</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <Stat label="MEMBERS" value={community?.member_count} money={false} />
            <Stat label="COUNTRIES" value={community?.country_count} money={false} />
          </div>
        </div>

        <a href="/admin/cases" className="inline-block mono text-[11px] tracking-[0.2em] text-white/60 underline">
          MANAGE CASES →
        </a>
      </div>
    </div>
  )
}

function Stat({ label, value, money = true }) {
  const display = value == null ? '—' : money ? `$${Number(value).toLocaleString()}` : value
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 text-center">
      <p className="text-2xl font-semibold mono">{display}</p>
      <p className="mt-2 text-[10px] tracking-[0.15em] text-white/45">{label}</p>
    </div>
  )
}
