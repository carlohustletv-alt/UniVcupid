create or replace function public.admin_recent_community_activity(result_limit int default 40)
returns table (kind text, title text, detail text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select * from (
    select 'opportunity'::text, o.kind || ': ' || o.title, coalesce(p.display_name, 'Member'), o.created_at from public.community_opportunities o left join public.profiles p on p.id = o.author_id
    union all
    select 'circle_comment', 'Circle comment', coalesce(p.display_name, 'Member') || ': ' || left(c.body, 100), c.created_at from public.circle_comments c left join public.profiles p on p.id = c.user_id where not c.is_deleted
    union all
    select 'event', 'Community event', e.venue, e.starts_at from public.vibe_events e
    union all
    select 'report', 'Safety report: ' || r.status, r.reason, r.created_at from public.reports r
    union all
    select 'vibe_tap', 'Vibe Tap', case when vt.claimed_at is null then 'Awaiting connection' else 'Connection completed' end, vt.expires_at from public.vibe_taps vt
    union all
    select 'verification', 'Verification: ' || p.verification_status, p.display_name, coalesce(p.verification_requested_at, p.created_at) from public.profiles p where p.verification_status <> 'unverified'
  ) activity order by created_at desc limit least(greatest(result_limit, 1), 100);
$$;
revoke all on function public.admin_recent_community_activity(int) from public;
grant execute on function public.admin_recent_community_activity(int) to authenticated;
