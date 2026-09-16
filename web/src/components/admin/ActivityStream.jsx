import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient.ts'

export default function ActivityStream() {
  const [events, setEvents] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const { data, error } = await supabase
        .from('system_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20)
      if (cancelled) return
      if (error) {
        console.error('[ActivityStream] failed to load system_events', error)
        setEvents([])
        return
      }
      setEvents(data ?? [])
    }
    load()

    const channel = supabase
      .channel('system_events_stream')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'system_events' }, (payload) => {
        setEvents((prev) => [payload.new, ...(prev ?? [])].slice(0, 20))
      })
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [])

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
      <p className="mono text-[11px] tracking-[0.2em] text-white/40 mb-4">ACTIVITY STREAM</p>
      {events === null && <p className="text-white/30 text-sm">Loading…</p>}
      {events?.length === 0 && <p className="text-white/30 text-sm">No activity yet.</p>}
      <div className="space-y-3">
        {events?.map((e) => (
          <div key={e.id} className="flex items-start gap-4 text-sm">
            <span className="mono text-[10px] text-white/35 shrink-0 w-12">
              {new Date(e.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            <div>
              <p className="mono text-[11px] tracking-[0.1em] text-white/80">{e.type.replace(/_/g, ' ')}</p>
              <p className="text-white/45 text-xs mt-0.5">{e.summary}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
