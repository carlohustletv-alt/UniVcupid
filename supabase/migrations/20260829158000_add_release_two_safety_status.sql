create or replace function public.get_block_state(target_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.blocks where blocker_id = auth.uid() and blocked_id = target_user);
$$;

create or replace function public.get_my_report_statuses()
returns table (id uuid, reason text, status text, created_at timestamptz) language sql stable security definer set search_path = public as $$
  select id, reason, status, created_at from public.reports where reporter_id = auth.uid() order by created_at desc limit 30;
$$;

create or replace function public.get_my_safety_status()
returns table (verification_status text, location_enabled boolean, location_expires_at timestamptz) language sql stable security definer set search_path = public as $$
  select p.verification_status, coalesce(l.enabled, false), l.expires_at from public.profiles p left join public.user_locations l on l.user_id = p.id where p.id = auth.uid();
$$;

revoke all on function public.get_block_state(uuid), public.get_my_report_statuses(), public.get_my_safety_status() from public;
grant execute on function public.get_block_state(uuid), public.get_my_report_statuses(), public.get_my_safety_status() to authenticated;
