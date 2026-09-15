// Milestone engine — checked after any event that could move a milestone
// metric (a confirmed fee event, a confirmed donation, a published impact
// report, a new community member). Idempotent: relies on the
// `unique (type, threshold)` constraint on the milestones table plus an
// explicit achieved_at IS NULL guard, so the same milestone can never fire
// twice even under concurrent invocations.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { notifyAll } from './notify.ts'

type MilestoneType = 'FUND' | 'DOGS_HELPED' | 'DONATIONS' | 'COMMUNITY'

async function currentMetricValue(
  supabase: SupabaseClient,
  type: MilestoneType
): Promise<number> {
  switch (type) {
    case 'FUND': {
      const { data } = await supabase.from('public_fund_summary').select('total_generated_usd').single()
      return data?.total_generated_usd ?? 0
    }
    case 'DONATIONS': {
      const { count } = await supabase
        .from('donations')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'confirmed')
      return count ?? 0
    }
    case 'DOGS_HELPED': {
      const { count } = await supabase
        .from('impact_reports')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'PUBLISHED')
      return count ?? 0
    }
    case 'COMMUNITY': {
      const { count } = await supabase.from('community_members').select('id', { count: 'exact', head: true })
      return count ?? 0
    }
  }
}

/**
 * Checks all unmet milestones of the given type and fires any whose
 * threshold has now been reached. Returns the milestones newly achieved.
 */
export async function checkMilestones(supabase: SupabaseClient, type: MilestoneType) {
  const currentValue = await currentMetricValue(supabase, type)

  const { data: pending, error } = await supabase
    .from('milestones')
    .select('*')
    .eq('type', type)
    .is('achieved_at', null)
    .lte('threshold', currentValue)
    .order('threshold', { ascending: true })

  if (error) {
    console.error('[milestones] failed to load pending milestones', error)
    return []
  }
  if (!pending || pending.length === 0) return []

  const achieved = []

  for (const milestone of pending) {
    // Guarded update: only succeeds if still unachieved at write time —
    // this is what makes concurrent invocations safe.
    const { data: updated, error: updateError } = await supabase
      .from('milestones')
      .update({ achieved_value: currentValue, achieved_at: new Date().toISOString() })
      .eq('id', milestone.id)
      .is('achieved_at', null)
      .select()
      .maybeSingle()

    if (updateError || !updated) continue

    achieved.push(updated)

    await notifyAll({
      kind: 'milestone',
      pawNumber: String(achieved.length).padStart(3, '0'),
      thresholdUsd: Number(updated.threshold),
      type,
    })
  }

  return achieved
}
