import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient.ts'
import { isDemoMode, DEMO_FUND_SUMMARY } from '../lib/demoMode.ts'

const EMPTY = {
  token_fees_usd: 0,
  direct_donations_usd: 0,
  draco_donations_usd: 0,
  disbursed_usd: 0,
  available_usd: 0,
  total_generated_usd: 0,
}

export default function usePublicFund() {
  const [summary, setSummary] = useState(isDemoMode ? DEMO_FUND_SUMMARY : EMPTY)
  const [loading, setLoading] = useState(!isDemoMode)

  useEffect(() => {
    if (isDemoMode) return

    let cancelled = false
    supabase
      .from('public_fund_summary')
      .select('*')
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          console.error('[usePublicFund] failed to load fund summary', error)
        }
        setSummary(data ?? EMPTY)
        setLoading(false)
      })
      .catch((error) => {
        if (cancelled) return
        console.error('[usePublicFund] failed to load fund summary', error)
        setSummary(EMPTY)
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return { summary, loading }
}
