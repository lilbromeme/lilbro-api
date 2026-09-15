import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient.ts'
import { logAdminAction } from '../../lib/auditLog.js'
import useAdminSession from '../../hooks/useAdminSession.js'
import AdminLogin from './AdminLogin.jsx'

// Case flow (per architecture doc):
// SUBMITTED -> VERIFICATION -> VERIFIED -> APPROVAL -> DISBURSEMENT -> IMPACT REPORT -> PUBLISHED
//
// Nothing here ever moves money automatically. Every step is an explicit
// admin action, and every action is written to admin_audit_logs.

export default function AdminCasesPage() {
  const { session, isAdmin, loading } = useAdminSession()
  const [cases, setCases] = useState([])
  const [selected, setSelected] = useState(null)

  async function loadCases() {
    const { data } = await supabase
      .from('cases')
      .select('*, dogs(name, location)')
      .order('created_at', { ascending: false })
    setCases(data ?? [])
  }

  useEffect(() => {
    if (isAdmin) loadCases()
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
      <div className="max-w-5xl mx-auto">
        <p className="mono text-[11px] tracking-[0.25em] text-white/40 mb-8">CASE MANAGEMENT</p>

        <div className="grid md:grid-cols-[1fr_1.3fr] gap-8">
          <div className="space-y-3">
            {cases.length === 0 && <p className="text-white/40 text-sm">No cases submitted yet.</p>}
            {cases.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelected(c)}
                className={`w-full text-left rounded-lg border px-4 py-3 transition ${
                  selected?.id === c.id ? 'border-white/40 bg-white/[0.06]' : 'border-white/10 bg-white/[0.02]'
                }`}
              >
                <p className="text-sm">{c.title}</p>
                <p className="mono text-[10px] tracking-[0.15em] text-white/40 mt-1">
                  {c.dogs?.name ?? 'Unknown dog'} · {c.verification_status} · {c.approval_status}
                </p>
              </button>
            ))}
          </div>

          <div>
            {selected ? (
              <CaseDetail caseRecord={selected} onChange={loadCases} />
            ) : (
              <p className="text-white/30 text-sm">Select a case to review.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function CaseDetail({ caseRecord, onChange }) {
  const [notes, setNotes] = useState('')
  const [amount, setAmount] = useState(caseRecord.approved_amount ?? '')
  const [txHash, setTxHash] = useState('')

  async function verify(result) {
    await supabase.from('verifications').insert({
      case_id: caseRecord.id,
      verification_type: 'manual_review',
      notes,
      result,
    })
    const newStatus = result === 'VERIFIED' ? 'VERIFIED' : 'REJECTED'
    await supabase.from('cases').update({ verification_status: newStatus }).eq('id', caseRecord.id)
    await logAdminAction({
      action: `case.verify.${result.toLowerCase()}`,
      targetTable: 'cases',
      targetId: caseRecord.id,
      previousValue: { verification_status: caseRecord.verification_status },
      newValue: { verification_status: newStatus },
    })
    onChange()
  }

  async function approve() {
    await supabase
      .from('cases')
      .update({ approval_status: 'APPROVED', approved_amount: Number(amount) })
      .eq('id', caseRecord.id)
    await logAdminAction({
      action: 'case.approve',
      targetTable: 'cases',
      targetId: caseRecord.id,
      previousValue: { approval_status: caseRecord.approval_status },
      newValue: { approval_status: 'APPROVED', approved_amount: Number(amount) },
    })
    onChange()
  }

  async function recordDisbursement() {
    // NOTE: this only records that a disbursement happened — it never
    // submits a blockchain transaction from this app. The actual transfer
    // must already have been executed via the multisig (see
    // src/lib/treasury/manualProvider.ts); this just logs the resulting
    // tx hash for the public impact ledger to reference.
    await supabase.from('disbursements').insert({
      case_id: caseRecord.id,
      amount: Number(amount),
      asset: 'USDC',
      recipient: caseRecord.organization_name ?? caseRecord.veterinarian_name ?? 'PLACEHOLDER',
      tx_hash: txHash || null,
      status: txHash ? 'CONFIRMED' : 'PENDING',
      completed_at: txHash ? new Date().toISOString() : null,
    })
    await logAdminAction({
      action: 'case.disbursement.record',
      targetTable: 'disbursements',
      targetId: caseRecord.id,
      newValue: { amount: Number(amount), tx_hash: txHash || null },
    })
    onChange()
  }

  async function publishReport() {
    await supabase.from('impact_reports').insert({
      case_id: caseRecord.id,
      title: caseRecord.title,
      summary: notes || caseRecord.description,
      amount_spent: Number(amount),
      status: 'PUBLISHED',
      published_at: new Date().toISOString(),
    })
    await logAdminAction({
      action: 'case.impact_report.publish',
      targetTable: 'impact_reports',
      targetId: caseRecord.id,
      newValue: { status: 'PUBLISHED' },
    })
    onChange()
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6 space-y-6">
      <div>
        <p className="text-lg">{caseRecord.title}</p>
        <p className="text-white/50 text-sm mt-2">{caseRecord.description}</p>
        <p className="mono text-[10px] tracking-[0.15em] text-white/35 mt-3">
          {caseRecord.category} · Requested ${caseRecord.requested_amount ?? '—'}
        </p>
      </div>

      <textarea
        placeholder="Verification / report notes"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        className="w-full rounded-lg border border-white/15 bg-white/[0.03] px-3 py-2 text-sm outline-none focus:border-white/40"
        rows={3}
      />

      <div className="flex flex-wrap gap-2">
        <button onClick={() => verify('VERIFIED')} className="btn-admin">Mark Verified</button>
        <button onClick={() => verify('REJECTED')} className="btn-admin">Reject</button>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="number"
          placeholder="Approved amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-40 rounded-lg border border-white/15 bg-white/[0.03] px-3 py-2 text-sm outline-none focus:border-white/40"
        />
        <button onClick={approve} className="btn-admin">Approve Amount</button>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder="Disbursement tx hash (after multisig execution)"
          value={txHash}
          onChange={(e) => setTxHash(e.target.value)}
          className="flex-1 rounded-lg border border-white/15 bg-white/[0.03] px-3 py-2 text-sm outline-none focus:border-white/40"
        />
        <button onClick={recordDisbursement} className="btn-admin">Record Disbursement</button>
      </div>

      <button onClick={publishReport} className="btn-admin w-full">
        Publish Impact Report
      </button>
    </div>
  )
}
