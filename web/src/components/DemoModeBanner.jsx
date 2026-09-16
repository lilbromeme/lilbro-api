import { isDemoMode } from '../lib/demoMode.ts'

export default function DemoModeBanner() {
  if (!isDemoMode) return null

  return (
    <div className="sticky top-0 z-[100] bg-amber-400 text-black text-center py-2.5 mono text-[12px] font-bold tracking-[0.25em]">
      ⚠ DEMO MODE — NOT REAL DATA ⚠
    </div>
  )
}
