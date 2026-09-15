import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient.ts'
import { isDemoMode, DEMO_IMPACT_RECORDS } from '../lib/demoMode.ts'

export default function usePublicImpact() {
  const [records, setRecords] = useState(isDemoMode ? DEMO_IMPACT_RECORDS : [])
  const [loading, setLoading] = useState(!isDemoMode)

  useEffect(() => {
    if (isDemoMode) return

    let cancelled = false
    supabase
      .from('public_impact_ledger')
      .select('*')
      .order('published_at', { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) console.error('[usePublicImpact] failed to load impact ledger', error)
        setRecords(data ?? [])
        setLoading(false)
      })
      .catch((error) => {
        if (cancelled) return
        console.error('[usePublicImpact] failed to load impact ledger', error)
        setRecords([])
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return { records, loading }
}
