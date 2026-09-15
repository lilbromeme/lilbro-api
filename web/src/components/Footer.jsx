export default function Footer() {
  return (
    <footer className="bg-black py-10 px-6 border-t border-white/5">
      <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 mono text-[10px] tracking-[0.2em] text-white/30">
        <span>DRACO // A MEMORY, STILL ALIVE</span>
        <span>© {new Date().getFullYear()}</span>
      </div>
    </footer>
  )
}
