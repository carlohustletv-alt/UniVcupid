create or replace function public.admin_community_data_summary()
returns table (saved_vibes bigint, opportunities bigint, circle_comments bigint, vibe_events bigint, message_reactions bigint, active_typing bigint, active_locations bigint, pending_verifications bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_app_admin();
  return query select
    (select count(*) from public.saved_vibes),
    (select count(*) from public.community_opportunities),
    (select count(*) from public.circle_comments where not is_deleted),
    (select count(*) from public.vibe_events),
    (select count(*) from public.message_reactions),
    (select count(*) from public.typing_presence where updated_at > now() - interval '2 minutes'),
    (select count(*) from public.user_locations where enabled and updated_at > now() - interval '15 minutes'),
    (select count(*) from public.profiles where verification_status = 'pending');
end;
$$;
revoke all on function public.admin_community_data_summary() from public;
grant execute on function public.admin_community_data_summary() to authenticated;
