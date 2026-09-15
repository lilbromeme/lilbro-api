import { useEffect, useState } from 'react'
import { callAdminFunction } from '../../lib/adminApi.js'
import useAdminSession from '../../hooks/useAdminSession.js'
import AdminLogin from './AdminLogin.jsx'
import AdminShell from '../../components/admin/AdminShell.jsx'

const STATUS_COPY = {
  RECONCILED: { label: '✓ RECONCILED', color: 'text-emerald-400' },
  RECONCILIATION_REQUIRED: { label: '⚠ RECONCILIATION REQUIRED', color: 'text-red-400' },
  BLOCKCHAIN_NOT_CONFIGURED: { label: '— BLOCKCHAIN NOT CONFIGURED', color: 'text-amber-400' },
  BLOCKCHAIN_READ_UNAVAILABLE: { label: '⚠ BLOCKCHAIN READ UNAVAILABLE', color: 'text-amber-400' },
}

export default function AdminReconciliationPage() {
  const { session, isAdmin, loading } = useAdminSession()
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!isAdmin) return
    callAdminFunction('reconciliation').then(setResult).catch((err) => setError(err.message))
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

  const copy = result ? STATUS_COPY[result.status] : null

  return (
    <AdminShell title="FUND RECONCILIATION">
      <p className="text-white/50 text-sm max-w-xl mb-8">
        Compares the blockchain's own record of the fund wallet's balance
        against this database's accounting and recorded disbursements.
        Discrepancies are never hidden.
      </p>

      {error && (
        <p className="text-amber-400 text-sm mono">
          Could not reach reconciliation function (expected until Edge Functions are deployed): {error}
        </p>
      )}

      {result && (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-8 max-w-2xl">
          <p className={`text-xl font-semibold mono ${copy?.color ?? 'text-white'}`}>{copy?.label ?? result.status}</p>

          <div className="grid grid-cols-3 gap-6 mt-8">
            <Field label="BLOCKCHAIN BALANCE" value={result.blockchain_balance_usd} />
            <Field label="DATABASE ACCOUNTING" value={result.database_available_usd} />
            <Field label="RECORDED DISBURSEMENTS" value={result.recorded_disbursements_usd} />
          </div>

          <p className="mono text-[10px] tracking-[0.15em] text-white/30 mt-8">
            LAST CHECKED: {new Date(result.checked_at).toLocaleString()}
          </p>
        </div>
      )}
    </AdminShell>
  )
}

function Field({ label, value }) {
  return (
    <div>
      <p className="mono text-[9px] tracking-[0.15em] text-white/40">{label}</p>
      <p className="mt-1 text-lg font-semibold mono">{value == null ? 'N/A' : `$${Number(value).toLocaleString()}`}</p>
    </div>
  )
}
