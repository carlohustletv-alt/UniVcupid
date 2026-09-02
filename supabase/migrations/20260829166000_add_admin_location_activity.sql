create or replace function public.admin_active_locations(result_limit int default 50)
returns table (display_name text, approximate_location text, updated_at timestamptz, enabled boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_app_admin();
  return query select p.display_name, round(l.latitude::numeric, 3)::text || ', ' || round(l.longitude::numeric, 3)::text, l.updated_at, l.enabled
  from public.user_locations l join public.profiles p on p.id = l.user_id
  where l.enabled and l.updated_at > now() - interval '15 minutes'
  order by l.updated_at desc limit least(greatest(result_limit, 1), 100);
end;
$$;
revoke all on function public.admin_active_locations(int) from public;
grant execute on function public.admin_active_locations(int) to authenticated;
