drop policy if exists "vibes readable when owner appears in vibe" on public.vibes;
drop policy if exists "vibes readable when visible to viewer" on public.vibes;
drop policy if exists "messages sent by self" on public.messages;
drop policy if exists "messages sent by conversation members" on public.messages;

create policy "vibes readable when visible to viewer" on public.vibes
for select using (
  exists (select 1 from public.privacy_settings ps where ps.user_id = vibes.user_id and ps.appear_in_vibe)
  and (visibility = 'public' or user_id = auth.uid() or public.are_vibesmates(auth.uid(), user_id))
);

create policy "messages sent by conversation members" on public.messages
for insert with check (
  auth.uid() = sender_id
  and exists (select 1 from public.conversation_members cm where cm.conversation_id = messages.conversation_id and cm.user_id = auth.uid())
);

create index if not exists profiles_created_at_idx on public.profiles (created_at desc);
create index if not exists profiles_age_created_idx on public.profiles (age, created_at desc);
create index if not exists privacy_cupid_user_idx on public.privacy_settings (appear_in_cupid, user_id) where appear_in_cupid = true;
create index if not exists vibes_public_created_idx on public.vibes (created_at desc) where visibility = 'public';
create index if not exists vibesmates_pair_lookup_idx on public.vibesmates (user_a, user_b);
create index if not exists conversation_members_conversation_user_idx on public.conversation_members (conversation_id, user_id);
create index if not exists messages_conversation_created_asc_idx on public.messages (conversation_id, created_at asc);
create index if not exists circle_posts_user_created_idx on public.circle_posts (user_id, created_at desc);
create index if not exists circles_created_at_idx on public.circles (created_at desc);

drop function if exists public.get_vibe_feed(uuid, text, int);
create function public.get_vibe_feed(viewer_id uuid, selected_vibe text default 'All', result_limit int default 20)
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
  with viewer_profile as (
    select university from profiles where id = viewer_id and viewer_id = auth.uid()
  ), viewer_interests as (
    select interest_id from user_interests where user_id = viewer_id and viewer_id = auth.uid()
  ), shared_counts as (
    select ui.user_id, count(*)::int as shared_count
    from user_interests ui
    join viewer_interests vi on vi.interest_id = ui.interest_id
    group by ui.user_id
  ), candidate_vibes as (
    select v.*
    from vibes v
    join privacy_settings ps on ps.user_id = v.user_id
    where viewer_id = auth.uid()
      and ps.appear_in_vibe
      and v.user_id <> viewer_id
      and (v.visibility = 'public' or public.are_vibesmates(viewer_id, v.user_id))
      and not exists (select 1 from blocks b where b.blocker_id = viewer_id and b.blocked_id = v.user_id)
      and not exists (select 1 from blocks b where b.blocker_id = v.user_id and b.blocked_id = viewer_id)
      and (selected_vibe in ('All', '✨ All') or v.activity ilike '%' || selected_vibe || '%' or selected_vibe ilike '%' || v.activity || '%')
    order by v.created_at desc
    limit least(greatest(result_limit, 1), 25)
  )
  select v.id, p.id, p.display_name,
    case when ps.show_age then p.age else null end,
    case when ps.show_university then p.university else null end,
    case when ps.show_course then p.course else null end,
    p.avatar_url, v.activity, v.caption, v.media_url, v.open_to_company, v.visibility,
    greatest(0, floor(extract(epoch from (now() - v.created_at)) / 60)::int),
    (select count(*) from vibe_reactions vr where vr.vibe_id = v.id),
    exists (select 1 from vibe_reactions vr where vr.vibe_id = v.id and vr.user_id = viewer_id),
    least(99, 58 + coalesce(sc.shared_count, 0) * 10 + case when p.university is not null and p.university = (select university from viewer_profile) then 12 else 0 end)
  from candidate_vibes v
  join profiles p on p.id = v.user_id
  join privacy_settings ps on ps.user_id = p.id
  left join shared_counts sc on sc.user_id = p.id
  order by v.created_at desc;
$$;

create or replace function public.search_circles_for_user(viewer_id uuid, search_query text default '', result_limit int default 30)
returns table (id uuid, name text, icon text, description text, campus text, active_count bigint, joined boolean)
language sql stable security definer set search_path = public as $$
  select c.id, c.name, c.icon, c.description, c.campus,
    (select count(*) from circle_members cm where cm.circle_id = c.id),
    exists (select 1 from circle_members mine where mine.circle_id = c.id and mine.user_id = viewer_id)
  from circles c
  where viewer_id = auth.uid()
    and (coalesce(trim(search_query), '') = '' or c.name ilike '%' || search_query || '%' or c.description ilike '%' || search_query || '%' or c.campus ilike '%' || search_query || '%')
  order by 6 desc, c.created_at desc
  limit least(greatest(result_limit, 1), 40);
$$;

create or replace function public.get_circle_posts(viewer_id uuid, target_circle_id uuid, result_limit int default 25)
returns table (id uuid, circle_id uuid, author_id uuid, display_name text, university text, course text, body text, prompt text, media_url text, minutes_ago int, reaction_count bigint, reacted_by_viewer boolean)
language sql stable security definer set search_path = public as $$
  select cp.id, cp.circle_id, p.id, p.display_name, p.university, p.course, cp.body, cp.prompt, cp.media_url,
    greatest(0, floor(extract(epoch from (now() - cp.created_at)) / 60)::int),
    (select count(*) from circle_post_reactions cpr where cpr.post_id = cp.id),
    exists (select 1 from circle_post_reactions cpr where cpr.post_id = cp.id and cpr.user_id = viewer_id)
  from circle_posts cp
  join profiles p on p.id = cp.user_id
  where viewer_id = auth.uid()
    and cp.circle_id = target_circle_id
    and exists (select 1 from circle_members cm where cm.circle_id = target_circle_id and cm.user_id = viewer_id)
  order by cp.created_at desc
  limit least(greatest(result_limit, 1), 30);
$$;
