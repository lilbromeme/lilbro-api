export function ChapterOpen({ number, label }) {
  return (
    <div className="chapter-anchor mb-6">
      {number} — {label}
    </div>
  )
}

export function ChapterClose({ number, total = '07' }) {
  return (
    <div className="mt-16 flex flex-col items-center gap-3 text-white/35">
      <span className="mono text-[10px] tracking-[0.2em]">
        {number} / {total}
      </span>
      <span className="mono text-[10px] tracking-[0.2em]">CONTINUE ↓</span>
    </div>
  )
}
