alter table public.profiles add column if not exists profile_details_updated_at timestamptz;

alter table public.app_admins drop constraint if exists app_admins_role_check;
alter table public.app_admins add constraint app_admins_role_check check (role in ('superadmin', 'admin', 'moderator'));

create or replace function public.is_superadmin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.app_admins where user_id = auth.uid() and active and role = 'superadmin');
$$;

create or replace function public.update_my_profile_details(p_display_name text, p_affiliation text, p_role text, p_bio text)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare next_edit timestamptz;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select profile_details_updated_at + interval '15 days' into next_edit from public.profiles where id = auth.uid();
  if next_edit is not null and next_edit > now() and not public.is_superadmin() then raise exception 'Profile details can be edited again after %', next_edit; end if;
  update public.profiles set display_name = trim(p_display_name), university = nullif(trim(p_affiliation), ''), course = nullif(trim(p_role), ''), bio = nullif(trim(p_bio), ''), profile_details_updated_at = now() where id = auth.uid();
  return now() + interval '15 days';
end;
$$;

create or replace function public.superadmin_update_profile_details(target_user uuid, p_display_name text, p_affiliation text, p_role text, p_bio text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_superadmin() then raise exception 'superadmin access required'; end if;
  update public.profiles set display_name = trim(p_display_name), university = nullif(trim(p_affiliation), ''), course = nullif(trim(p_role), ''), bio = nullif(trim(p_bio), ''), profile_details_updated_at = now() where id = target_user;
end;
$$;

revoke all on function public.update_my_profile_details(text, text, text, text), public.superadmin_update_profile_details(uuid, text, text, text, text) from public;
grant execute on function public.update_my_profile_details(text, text, text, text) to authenticated;
