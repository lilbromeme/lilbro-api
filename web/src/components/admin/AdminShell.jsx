import { Link, useLocation } from 'react-router-dom'

// Deliberately un-cinematic: precise, technical, operational. The public
// site is the memorial; this is the command center. Monospace, muted
// grid background, status pills — no film grain, no scroll storytelling.

const NAV = [
  { to: '/admin', label: 'CONTROL' },
  { to: '/admin/cases', label: 'CASES' },
  { to: '/admin/reconciliation', label: 'RECONCILIATION' },
  { to: '/admin/settings', label: 'SETTINGS' },
  { to: '/admin/launch', label: 'LAUNCH READINESS' },
]

export default function AdminShell({ title, children }) {
  const location = useLocation()

  return (
    <div className="min-h-screen bg-[#0b0c0e] text-[#e8e8e6]">
      <div
        className="fixed inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      <header className="relative border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link to="/admin" className="mono text-xs tracking-[0.25em] text-white/90">
            DRACO CONTROL
          </Link>
          <nav className="hidden md:flex gap-5">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={`mono text-[11px] tracking-[0.15em] transition ${
                  location.pathname === item.to ? 'text-white' : 'text-white/40 hover:text-white/70'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <Link to="/" className="mono text-[10px] tracking-[0.15em] text-white/30 hover:text-white/60">
          ← PUBLIC SITE
        </Link>
      </header>

      <main className="relative px-6 py-10 max-w-6xl mx-auto">
        {title && (
          <p className="mono text-[11px] tracking-[0.25em] text-white/40 mb-8">{title}</p>
        )}
        {children}
      </main>
    </div>
  )
}
