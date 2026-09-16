const COLORS = {
  connected: 'bg-emerald-500',
  ok: 'bg-emerald-500',
  not_configured: 'bg-amber-500',
  pending: 'bg-amber-500',
  disconnected: 'bg-red-500',
  error: 'bg-red-500',
}

const LABELS = {
  connected: 'CONNECTED',
  ok: 'OK',
  not_configured: 'NOT CONFIGURED',
  pending: 'PENDING',
  disconnected: 'DISCONNECTED',
  error: 'ERROR',
}

export default function StatusPill({ status, label }) {
  const dotColor = COLORS[status] ?? 'bg-white/30'
  const text = label ?? LABELS[status] ?? status

  return (
    <span className="inline-flex items-center gap-2 mono text-[10px] tracking-[0.15em] text-white/70">
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
      {text}
    </span>
  )
}
