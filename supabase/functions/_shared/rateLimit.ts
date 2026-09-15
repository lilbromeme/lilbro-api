// Minimal fixed-window rate limiter backed by the rate_limit_hits table.
// This is a courtesy backstop, not the primary defense — put real rate
// limiting at the edge/WAF in front of any publicly exposed function
// before launch (see docs/SECURITY.md's pre-launch checklist).

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export async function checkRateLimit(
  supabase: SupabaseClient,
  bucketKey: string,
  { maxHits, windowSeconds }: { maxHits: number; windowSeconds: number }
): Promise<{ allowed: boolean; count: number }> {
  const windowStart = new Date(Date.now() - windowSeconds * 1000).toISOString()

  const { count } = await supabase
    .from('rate_limit_hits')
    .select('id', { count: 'exact', head: true })
    .eq('bucket_key', bucketKey)
    .gte('created_at', windowStart)

  const currentCount = count ?? 0
  if (currentCount >= maxHits) {
    return { allowed: false, count: currentCount }
  }

  await supabase.from('rate_limit_hits').insert({ bucket_key: bucketKey })
  return { allowed: true, count: currentCount + 1 }
}
