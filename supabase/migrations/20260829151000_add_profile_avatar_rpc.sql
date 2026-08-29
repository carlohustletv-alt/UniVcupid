-- Profile photos are stored in the existing vibe-media bucket under the owner's folder.
create or replace function public.update_my_profile_avatar(p_avatar_url text)
returns void language plpgsql security definer set search_path = public as $$
declare
  viewer uuid := auth.uid();
  new_avatar_url text := nullif(trim(coalesce(p_avatar_url, '')), '');
begin
  if viewer is null then raise exception 'not authenticated'; end if;
  if new_avatar_url is not null and position('/vibe-media/' || viewer::text || '/' in new_avatar_url) = 0 then
    raise exception 'profile photo must be stored in your media folder';
  end if;

  update public.profiles set avatar_url = new_avatar_url where id = viewer;
end;
$$;

revoke all on function public.update_my_profile_avatar(text) from public;
grant execute on function public.update_my_profile_avatar(text) to authenticated;
