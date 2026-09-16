import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient.ts'
import { isDemoMode, DEMO_MILESTONES } from '../lib/demoMode.ts'

export default function usePublicMilestones() {
  const [milestones, setMilestones] = useState(isDemoMode ? DEMO_MILESTONES : [])
  const [loading, setLoading] = useState(!isDemoMode)

  useEffect(() => {
    if (isDemoMode) return
    let cancelled = false
    supabase
      .from('public_milestones')
      .select('*')
      .order('achieved_at', { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) console.error('[usePublicMilestones] failed to load milestones', error)
        setMilestones(data ?? [])
        setLoading(false)
      })
      .catch((error) => {
        if (cancelled) return
        console.error('[usePublicMilestones] failed to load milestones', error)
        setMilestones([])
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { milestones, loading }
}
