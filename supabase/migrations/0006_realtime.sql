-- Enable Supabase Realtime on system_events so the admin Activity Stream
-- updates live without polling. Safe to run even if the publication
-- already includes it (guarded).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'system_events'
  ) then
    alter publication supabase_realtime add table system_events;
  end if;
end $$;
