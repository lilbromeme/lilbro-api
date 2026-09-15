import { isDemoMode } from '../lib/demoMode.ts'

export default function DemoModeBanner() {
  if (!isDemoMode) return null

  return (
    <div className="sticky top-0 z-[100] bg-amber-400 text-black text-center py-2 mono text-[11px] tracking-[0.2em]">
      DEMO DATA — NOT REAL FUND ACTIVITY
    </div>
  )
}
