import { Link } from 'react-router-dom'

const LINKS = [
  { to: '/donate', label: 'DONATE' },
  { to: '/fund', label: 'FUND' },
  { to: '/impact', label: 'IMPACT' },
  { to: '/transparency', label: 'TRANSPARENCY' },
]

export default function Footer() {
  return (
    <footer className="bg-black py-10 px-6 border-t border-white/5">
      <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 mono text-[10px] tracking-[0.2em] text-white/30">
        <span>DRACO // A MEMORY, STILL ALIVE</span>
        <div className="flex gap-5">
          {LINKS.map((l) => (
            <Link key={l.to} to={l.to} className="hover:text-white/60 transition">
              {l.label}
            </Link>
          ))}
        </div>
        <span>© {new Date().getFullYear()}</span>
      </div>
    </footer>
  )
}
