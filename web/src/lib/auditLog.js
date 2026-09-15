import { supabase } from './supabaseClient.ts'

/**
 * Writes an admin_audit_logs row. Call this from every admin mutation
 * (verify, approve, disburse, publish) alongside the actual write — RLS
 * only allows admins to insert here, and the table is never publicly
 * readable, but every state change should still leave a trace.
 */
export async function logAdminAction({ action, targetTable, targetId, previousValue, newValue }) {
  const { data: userData } = await supabase.auth.getUser()
  const { error } = await supabase.from('admin_audit_logs').insert({
    actor_id: userData?.user?.id ?? null,
    action,
    target_table: targetTable,
    target_id: targetId,
    previous_value: previousValue ?? null,
    new_value: newValue ?? null,
  })
  if (error) {
    // Never block the actual mutation on audit-log failure, but always
    // surface it loudly — a silently-failing audit trail defeats the point.
    console.error('[auditLog] failed to record admin action', action, error)
  }
}
