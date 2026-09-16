import { useEffect, useState } from 'react'
import { callAdminFunction } from '../../lib/adminApi.js'
import StatusPill from './StatusPill.jsx'

const ROWS = [
  { key: 'blockchain', label: 'BLOCKCHAIN' },
  { key: 'database', label: 'DATABASE' },
  { key: 'donation_provider', label: 'DONATION PROVIDER' },
  { key: 'telegram', label: 'TELEGRAM' },
  { key: 'discord', label: 'DISCORD' },
  { key: 'treasury', label: 'TREASURY' },
]

export default function SystemHealthPanel() {
  const [health, setHealth] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    callAdminFunction('system-health')
      .then(setHealth)
      .catch((err) => setError(err.message))
  }, [])

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
      <p className="mono text-[11px] tracking-[0.2em] text-white/40 mb-4">SYSTEM HEALTH</p>
      {error && (
        <p className="text-amber-400 text-xs mono">
          Could not reach system-health function (expected until Edge Functions are deployed): {error}
        </p>
      )}
      {!error && !health && <p className="text-white/30 text-sm">Checking…</p>}
      {health && (
        <div className="grid grid-cols-2 gap-4">
          {ROWS.map((r) => (
            <div key={r.key} className="flex items-center justify-between">
              <span className="mono text-[10px] tracking-[0.15em] text-white/50">{r.label}</span>
              <StatusPill status={health[r.key] ?? 'disconnected'} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
