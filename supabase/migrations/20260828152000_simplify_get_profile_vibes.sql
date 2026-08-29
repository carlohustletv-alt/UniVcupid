create or replace function public.get_profile_vibes(viewer_id uuid, profile_user_id uuid, result_limit int default 30)
returns table (
  id uuid,
  author_id uuid,
  display_name text,
  age int,
  university text,
  course text,
  avatar_url text,
  activity text,
  caption text,
  media_url text,
  open_to_company boolean,
  visibility text,
  minutes_ago int,
  reaction_count bigint,
  reacted_by_viewer boolean,
  common_vibe_percent int
) language sql stable security definer set search_path = public as $$
  select
    v.id, p.id, p.display_name,
    case when ps.show_age then p.age else null end,
    case when ps.show_university then p.university else null end,
    case when ps.show_course then p.course else null end,
    p.avatar_url, v.activity, v.caption, v.media_url, v.open_to_company, v.visibility,
    greatest(0, floor(extract(epoch from (now() - v.created_at)) / 60)::int),
    (select count(*) from vibe_reactions vr where vr.vibe_id = v.id),
    exists (select 1 from vibe_reactions vr where vr.vibe_id = v.id and vr.user_id = viewer_id),
    100
  from vibes v
  join profiles p on p.id = v.user_id
  join privacy_settings ps on ps.user_id = p.id
  where v.user_id = profile_user_id
    and ps.appear_in_vibe
    and (v.user_id = viewer_id or v.visibility = 'public' or public.are_vibesmates(viewer_id, v.user_id))
  order by v.created_at desc
  limit least(greatest(result_limit, 1), 50);
$$;
