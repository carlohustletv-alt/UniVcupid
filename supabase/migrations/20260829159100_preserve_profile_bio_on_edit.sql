create or replace function public.update_my_profile_details(p_display_name text, p_affiliation text, p_role text, p_bio text)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare next_edit timestamptz;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select profile_details_updated_at + interval '15 days' into next_edit from public.profiles where id = auth.uid();
  if next_edit is not null and next_edit > now() and not public.is_superadmin() then raise exception 'Profile details can be edited again after %', next_edit; end if;
  update public.profiles set display_name = trim(p_display_name), university = nullif(trim(p_affiliation), ''), course = nullif(trim(p_role), ''), bio = coalesce(nullif(trim(p_bio), ''), bio), profile_details_updated_at = now() where id = auth.uid();
  return now() + interval '15 days';
end;
$$;
