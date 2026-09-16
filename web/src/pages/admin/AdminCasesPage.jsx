import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient.ts'
import { logAdminAction } from '../../lib/auditLog.js'
import { emitEvent } from '../../lib/emitEvent.js'
import { uploadCaseEvidence, getEvidenceSignedUrl } from '../../lib/evidenceUpload.js'
import { getTreasuryProvider } from '../../lib/treasury/index.ts'
import useAdminSession from '../../hooks/useAdminSession.js'
import AdminLogin from './AdminLogin.jsx'
import AdminShell from '../../components/admin/AdminShell.jsx'

// Full case pipeline (per architecture doc):
// SUBMITTED -> DOCUMENT_REVIEW -> VERIFIED -> APPROVED -> TREASURY_PROPOSAL
// -> AUTHORIZED_PAYMENT -> CONFIRMED -> IMPACT_REPORT -> PUBLISHED
//
// Nothing here ever moves money automatically. Every transition writes to
// admin_audit_logs, and public-facing events (funded/published) also flow
// through the central dispatcher (supabase/functions/_shared/events.ts)
// via the notify-event Edge Function, so Telegram/Discord never need
// secrets in the browser.

const STAGES = [
  'SUBMITTED',
  'DOCUMENT_REVIEW',
  'VERIFIED',
  'APPROVED',
  'TREASURY_PROPOSAL',
  'AUTHORIZED_PAYMENT',
  'CONFIRMED',
  'IMPACT_REPORT',
  'PUBLISHED',
]

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
    if (selected) {
      const refreshed = (data ?? []).find((c) => c.id === selected.id)
      if (refreshed) setSelected(refreshed)
    }
  }

  useEffect(() => {
    if (isAdmin) loadCases()
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    <AdminShell title="CASE MANAGEMENT">
      <div className="grid md:grid-cols-[1fr_1.4fr] gap-8">
        <div className="space-y-3">
          <button
            onClick={() => setSelected('new')}
            className="w-full text-left rounded-lg border border-dashed border-white/20 px-4 py-3 text-sm text-white/50 hover:text-white/80 hover:border-white/40 transition"
          >
            + New case
          </button>
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
              <div className="flex items-center gap-2 mt-1">
                <StagePill stage={c.stage} />
                {c.possible_duplicate_of && (
                  <span className="mono text-[9px] tracking-[0.1em] text-amber-400">POSSIBLE DUPLICATE</span>
                )}
              </div>
              <p className="mono text-[10px] tracking-[0.15em] text-white/40 mt-1">
                {c.dogs?.name ?? 'Unknown dog'}
              </p>
            </button>
          ))}
        </div>

        <div>
          {selected === 'new' ? (
            <NewCaseForm onCreated={loadCases} onDone={() => setSelected(null)} />
          ) : selected ? (
            <CaseDetail caseRecord={selected} onChange={loadCases} />
          ) : (
            <p className="text-white/30 text-sm">Select a case to review.</p>
          )}
        </div>
      </div>
    </AdminShell>
  )
}

function StagePill({ stage }) {
  const isTerminal = stage === 'PUBLISHED'
  const isRejected = stage === 'REJECTED'
  return (
    <span
      className={`mono text-[9px] tracking-[0.15em] px-2 py-0.5 rounded-full border ${
        isRejected
          ? 'border-red-500/40 text-red-400'
          : isTerminal
            ? 'border-emerald-500/40 text-emerald-400'
            : 'border-white/20 text-white/60'
      }`}
    >
      {stage}
    </span>
  )
}

function NewCaseForm({ onCreated, onDone }) {
  const [dogName, setDogName] = useState('')
  const [location, setLocation] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('MEDICAL')
  const [requestedAmount, setRequestedAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const { data: dog, error: dogError } = await supabase
        .from('dogs')
        .insert({ name: dogName, location, status: 'SUBMITTED' })
        .select()
        .single()
      if (dogError) throw dogError

      const { data: newCase, error: caseError } = await supabase
        .from('cases')
        .insert({
          dog_id: dog.id,
          title,
          description,
          category,
          requested_amount: requestedAmount ? Number(requestedAmount) : null,
          stage: 'SUBMITTED',
        })
        .select()
        .single()
      if (caseError) throw caseError

      await logAdminAction({
        action: 'case.create',
        targetTable: 'cases',
        targetId: newCase.id,
        newValue: newCase,
      })
      await emitEvent('CASE_SUBMITTED', { caseId: newCase.id, title: newCase.title })

      onCreated()
      onDone()
    } catch (err) {
      alert(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-white/10 bg-white/[0.02] p-6 space-y-4">
      <p className="mono text-[11px] tracking-[0.2em] text-white/40">NEW CASE</p>
      <input required placeholder="Dog name" value={dogName} onChange={(e) => setDogName(e.target.value)} className="admin-input" />
      <input placeholder="Location" value={location} onChange={(e) => setLocation(e.target.value)} className="admin-input" />
      <input required placeholder="Case title" value={title} onChange={(e) => setTitle(e.target.value)} className="admin-input" />
      <textarea placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} className="admin-input" rows={3} />
      <div className="flex gap-3">
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="admin-input">
          {['FOOD', 'MEDICAL', 'RESCUE', 'SHELTER', 'OTHER'].map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <input
          type="number"
          placeholder="Requested amount (USD)"
          value={requestedAmount}
          onChange={(e) => setRequestedAmount(e.target.value)}
          className="admin-input"
        />
      </div>
      <button disabled={submitting} type="submit" className="btn-admin w-full">
        {submitting ? 'Creating…' : 'Create case'}
      </button>
    </form>
  )
}

function CaseDetail({ caseRecord, onChange }) {
  const [notes, setNotes] = useState('')
  const [amount, setAmount] = useState(caseRecord.approved_amount ?? caseRecord.requested_amount ?? '')
  const [txHash, setTxHash] = useState('')
  const [evidence, setEvidence] = useState([])
  const [history, setHistory] = useState([])
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    supabase
      .from('case_evidence')
      .select('*')
      .eq('case_id', caseRecord.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setEvidence(data ?? []))

    supabase
      .from('admin_audit_logs')
      .select('*')
      .eq('target_id', caseRecord.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setHistory(data ?? []))
  }, [caseRecord.id])

  async function updateStage(stage, extra = {}) {
    await supabase.from('cases').update({ stage, ...extra }).eq('id', caseRecord.id)
  }

  async function handleUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const { data: userData } = await supabase.auth.getUser()
      const record = await uploadCaseEvidence({
        caseId: caseRecord.id,
        file,
        kind: 'OTHER',
        userId: userData?.user?.id,
      })
      setEvidence((prev) => [record, ...prev])
      if (caseRecord.stage === 'SUBMITTED') {
        await updateStage('DOCUMENT_REVIEW')
        await logAdminAction({
          action: 'case.stage.document_review',
          targetTable: 'cases',
          targetId: caseRecord.id,
          previousValue: { stage: 'SUBMITTED' },
          newValue: { stage: 'DOCUMENT_REVIEW' },
        })
        onChange()
      }
    } catch (err) {
      alert(err.message)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  async function viewEvidence(item) {
    const url = await getEvidenceSignedUrl(item.storage_path)
    window.open(url, '_blank', 'noopener')
  }

  async function verify(result) {
    await supabase.from('verifications').insert({
      case_id: caseRecord.id,
      verification_type: 'manual_review',
      notes,
      result,
    })
    const newVerificationStatus = result === 'VERIFIED' ? 'VERIFIED' : 'REJECTED'
    const newStage = result === 'VERIFIED' ? 'VERIFIED' : 'REJECTED'
    await supabase.from('cases').update({ verification_status: newVerificationStatus, stage: newStage }).eq('id', caseRecord.id)
    await logAdminAction({
      action: `case.verify.${result.toLowerCase()}`,
      targetTable: 'cases',
      targetId: caseRecord.id,
      previousValue: { verification_status: caseRecord.verification_status, stage: caseRecord.stage },
      newValue: { verification_status: newVerificationStatus, stage: newStage },
    })
    await emitEvent(result === 'VERIFIED' ? 'CASE_VERIFIED' : 'CASE_REJECTED', {
      caseId: caseRecord.id,
      title: caseRecord.title,
      result,
    })
    onChange()
  }

  async function approve() {
    if (!amount || Number(amount) <= 0) {
      alert('Enter an approved amount first.')
      return
    }
    await supabase
      .from('cases')
      .update({ approval_status: 'APPROVED', approved_amount: Number(amount), stage: 'APPROVED' })
      .eq('id', caseRecord.id)
    await logAdminAction({
      action: 'case.approve',
      targetTable: 'cases',
      targetId: caseRecord.id,
      previousValue: { approval_status: caseRecord.approval_status, stage: caseRecord.stage },
      newValue: { approval_status: 'APPROVED', approved_amount: Number(amount), stage: 'APPROVED' },
    })
    await emitEvent('CASE_APPROVED', { caseId: caseRecord.id, title: caseRecord.title, amount: Number(amount) })
    onChange()
  }

  async function createTreasuryProposal() {
    const provider = getTreasuryProvider()
    const proposal = await provider.createProposal({
      caseId: caseRecord.id,
      amount: Number(amount),
      asset: 'USDC',
      recipient: caseRecord.organization_name ?? caseRecord.veterinarian_name ?? 'PLACEHOLDER',
    })
    await supabase.from('disbursements').insert({
      case_id: caseRecord.id,
      amount: Number(amount),
      asset: proposal.asset,
      recipient: proposal.recipient,
      status: 'PENDING',
    })
    await updateStage('TREASURY_PROPOSAL')
    await logAdminAction({
      action: 'case.treasury_proposal.create',
      targetTable: 'disbursements',
      targetId: caseRecord.id,
      newValue: { proposalId: proposal.id, provider: provider.id, amount: Number(amount) },
    })
    onChange()
  }

  async function recordDisbursement() {
    if (!txHash) {
      alert('Paste the transaction hash from the executed multisig payment first.')
      return
    }
    await supabase
      .from('disbursements')
      .update({ tx_hash: txHash, status: 'CONFIRMED', completed_at: new Date().toISOString() })
      .eq('case_id', caseRecord.id)
      .eq('status', 'PENDING')

    await updateStage('CONFIRMED')
    await logAdminAction({
      action: 'case.disbursement.confirm',
      targetTable: 'disbursements',
      targetId: caseRecord.id,
      newValue: { tx_hash: txHash },
    })
    await emitEvent('CASE_FUNDED', {
      caseId: caseRecord.id,
      caseNumber: caseRecord.id.slice(0, 8),
      purpose: caseRecord.title,
      amountUsd: Number(amount),
      proofUrl: null,
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
    await updateStage('PUBLISHED')
    await logAdminAction({
      action: 'case.impact_report.publish',
      targetTable: 'impact_reports',
      targetId: caseRecord.id,
      newValue: { status: 'PUBLISHED' },
    })
    await emitEvent('IMPACT_PUBLISHED', {
      caseId: caseRecord.id,
      caseNumber: caseRecord.id.slice(0, 8),
      title: caseRecord.title,
      amountUsd: Number(amount),
      proofUrl: null,
    })
    onChange()
  }

  const stageIndex = STAGES.indexOf(caseRecord.stage)

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6 space-y-8">
      <div>
        <div className="flex items-center justify-between">
          <p className="text-lg">{caseRecord.title}</p>
          <StagePill stage={caseRecord.stage} />
        </div>
        <p className="text-white/50 text-sm mt-2">{caseRecord.description}</p>
        <p className="mono text-[10px] tracking-[0.15em] text-white/35 mt-3">
          {caseRecord.category} · Requested ${caseRecord.requested_amount ?? '—'}
        </p>
        {caseRecord.possible_duplicate_of && (
          <p className="mono text-[10px] tracking-[0.15em] text-amber-400 mt-2">
            ⚠ POSSIBLE DUPLICATE OF CASE {caseRecord.possible_duplicate_of.slice(0, 8)} — REVIEW BEFORE PROCEEDING
          </p>
        )}
      </div>

      {/* pipeline progress */}
      <div className="flex flex-wrap gap-1.5">
        {STAGES.map((s, i) => (
          <span
            key={s}
            className={`mono text-[8px] tracking-[0.1em] px-2 py-1 rounded ${
              i <= stageIndex && caseRecord.stage !== 'REJECTED' ? 'bg-white/15 text-white' : 'bg-white/[0.03] text-white/25'
            }`}
          >
            {s}
          </span>
        ))}
      </div>

      {/* evidence */}
      <div>
        <p className="mono text-[10px] tracking-[0.2em] text-white/40 mb-2">EVIDENCE (PRIVATE)</p>
        <div className="space-y-2 mb-3">
          {evidence.map((item) => (
            <button
              key={item.id}
              onClick={() => viewEvidence(item)}
              className="w-full text-left text-sm text-white/70 hover:text-white flex items-center justify-between rounded-lg border border-white/10 px-3 py-2"
            >
              <span>{item.file_name}</span>
              <span className="mono text-[9px] text-white/30">{(item.file_size / 1024).toFixed(0)}KB</span>
            </button>
          ))}
          {evidence.length === 0 && <p className="text-white/30 text-sm">No evidence uploaded yet.</p>}
        </div>
        <label className="btn-admin inline-block cursor-pointer">
          {uploading ? 'Uploading…' : 'Upload evidence'}
          <input type="file" onChange={handleUpload} className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp,.heic" />
        </label>
      </div>

      <textarea
        placeholder="Verification / report notes"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        className="admin-input"
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
          className="admin-input w-40"
        />
        <button onClick={approve} className="btn-admin">Approve Amount</button>
      </div>

      <div>
        <button onClick={createTreasuryProposal} className="btn-admin w-full">
          Create Treasury Proposal
        </button>
        <p className="text-[10px] text-white/30 mt-1">
          This only records intent — no funds move automatically. Execute the actual payment through the real multisig, then paste the tx hash below.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder="Disbursement tx hash (after multisig execution)"
          value={txHash}
          onChange={(e) => setTxHash(e.target.value)}
          className="admin-input flex-1"
        />
        <button onClick={recordDisbursement} className="btn-admin">Confirm Disbursement</button>
      </div>

      <button onClick={publishReport} className="btn-admin w-full">
        Publish Impact Report
      </button>

      {/* history */}
      <div>
        <p className="mono text-[10px] tracking-[0.2em] text-white/40 mb-2">HISTORY</p>
        <div className="space-y-2">
          {history.length === 0 && <p className="text-white/30 text-sm">No actions recorded yet.</p>}
          {history.map((h) => (
            <div key={h.id} className="text-xs border-l border-white/10 pl-3">
              <p className="mono text-white/60">{h.action}</p>
              <p className="text-white/30">{new Date(h.created_at).toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
