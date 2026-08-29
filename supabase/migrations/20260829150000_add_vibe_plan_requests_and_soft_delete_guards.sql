-- Turn "open to company" Vibes into moderated, consent-based campus plans.

create table if not exists public.vibe_join_requests (
  id uuid primary key default gen_random_uuid(),
  vibe_id uuid not null references public.vibes(id) on delete cascade,
  requester_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (vibe_id, requester_id)
);

alter table public.vibe_join_requests enable row level security;

create policy "vibe join requests visible to participants" on public.vibe_join_requests
for select using (
  requester_id = auth.uid()
  or exists (select 1 from public.vibes v where v.id = vibe_join_requests.vibe_id and v.user_id = auth.uid())
);

create index if not exists vibe_join_requests_host_idx on public.vibe_join_requests (vibe_id, status, created_at desc);
create index if not exists vibe_join_requests_requester_idx on public.vibe_join_requests (requester_id, status, created_at desc);

create or replace function public.request_to_join_vibe(target_vibe_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  viewer uuid := auth.uid();
  host uuid;
  request_id uuid;
begin
  select v.user_id into host
  from public.vibes v
  join public.privacy_settings ps on ps.user_id = v.user_id
  where v.id = target_vibe_id
    and v.open_to_company
    and not v.is_deleted
    and ps.appear_in_vibe
    and (v.visibility = 'public' or public.are_vibesmates(viewer, v.user_id));

  if viewer is null or host is null or host = viewer then raise exception 'This Vibe is not available to join'; end if;
  if exists (
    select 1 from public.blocks b
    where (b.blocker_id = viewer and b.blocked_id = host)
       or (b.blocker_id = host and b.blocked_id = viewer)
  ) then raise exception 'This plan is unavailable'; end if;

  insert into public.vibe_join_requests (vibe_id, requester_id)
  values (target_vibe_id, viewer)
  on conflict (vibe_id, requester_id) do update set status = 'pending', responded_at = null
  returning id into request_id;
  return request_id;
end;
$$;

create or replace function public.accept_vibe_join_request(request_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  requester uuid;
  host uuid;
begin
  select r.requester_id, v.user_id into requester, host
  from public.vibe_join_requests r
  join public.vibes v on v.id = r.vibe_id
  where r.id = request_id and r.status = 'pending' and not v.is_deleted;

  if requester is null or host <> auth.uid() then raise exception 'not allowed'; end if;
  update public.vibe_join_requests set status = 'accepted', responded_at = now() where id = request_id;
  return public.ensure_conversation(host, requester);
end;
$$;

create or replace function public.decline_vibe_join_request(request_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.vibe_join_requests r
  set status = 'declined', responded_at = now()
  from public.vibes v
  where r.id = request_id and r.vibe_id = v.id and v.user_id = auth.uid() and r.status = 'pending';
end;
$$;

create or replace function public.get_incoming_vibe_join_requests(viewer_id uuid)
returns table (id uuid, vibe_id uuid, requester_id uuid, display_name text, university text, course text, activity text, caption text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select r.id, v.id, p.id, p.display_name, p.university, p.course, v.activity, v.caption, r.created_at
  from public.vibe_join_requests r
  join public.vibes v on v.id = r.vibe_id
  join public.profiles p on p.id = r.requester_id
  where viewer_id = auth.uid() and v.user_id = viewer_id and r.status = 'pending' and not v.is_deleted
  order by r.created_at desc;
$$;

-- Hide soft-deleted content from normal student reads while preserving rows for admin audit RPCs.
drop policy if exists "vibes readable when visible to viewer" on public.vibes;
create policy "vibes readable when visible to viewer" on public.vibes
for select using (
  not is_deleted
  and exists (select 1 from public.privacy_settings ps where ps.user_id = vibes.user_id and ps.appear_in_vibe)
  and (visibility = 'public' or user_id = auth.uid() or public.are_vibesmates(auth.uid(), user_id))
);

drop policy if exists "circle posts readable by members" on public.circle_posts;
create policy "circle posts readable by members" on public.circle_posts
for select using (
  not is_deleted
  and exists (select 1 from public.circle_members cm where cm.circle_id = circle_posts.circle_id and cm.user_id = auth.uid())
);

drop policy if exists "messages readable by conversation members" on public.messages;
create policy "messages readable by conversation members" on public.messages
for select using (
  not is_deleted
  and exists (select 1 from public.conversation_members cm where cm.conversation_id = messages.conversation_id and cm.user_id = auth.uid())
);

drop policy if exists "messages sent by conversation members" on public.messages;
create policy "messages sent by conversation members" on public.messages
for insert with check (
  auth.uid() = sender_id
  and exists (select 1 from public.conversation_members cm where cm.conversation_id = messages.conversation_id and cm.user_id = auth.uid())
  and not exists (
    select 1
    from public.conversation_members other
    join public.blocks b on (b.blocker_id = auth.uid() and b.blocked_id = other.user_id) or (b.blocker_id = other.user_id and b.blocked_id = auth.uid())
    where other.conversation_id = messages.conversation_id and other.user_id <> auth.uid()
  )
);

create or replace function public.get_circle_posts(viewer_id uuid, target_circle_id uuid, result_limit int default 50)
returns table (id uuid, circle_id uuid, author_id uuid, display_name text, university text, course text, body text, prompt text, media_url text, minutes_ago int, reaction_count bigint, reacted_by_viewer boolean)
language sql stable security definer set search_path = public as $$
  select cp.id, cp.circle_id, p.id, p.display_name, p.university, p.course, cp.body, cp.prompt, cp.media_url,
    greatest(0, floor(extract(epoch from (now() - cp.created_at)) / 60)::int),
    count(cpr.user_id), bool_or(cpr.user_id = viewer_id)
  from public.circle_posts cp
  join public.profiles p on p.id = cp.user_id
  left join public.circle_post_reactions cpr on cpr.post_id = cp.id
  where viewer_id = auth.uid() and cp.circle_id = target_circle_id and not cp.is_deleted
    and exists (select 1 from public.circle_members cm where cm.circle_id = target_circle_id and cm.user_id = viewer_id)
  group by cp.id, p.id
  order by cp.created_at desc
  limit least(greatest(result_limit, 1), 100);
$$;

create or replace function public.get_profile_vibes(viewer_id uuid, profile_user_id uuid, result_limit int default 30)
returns table (id uuid, author_id uuid, display_name text, age int, university text, course text, avatar_url text, activity text, caption text, media_url text, open_to_company boolean, visibility text, minutes_ago int, reaction_count bigint, reacted_by_viewer boolean, common_vibe_percent int)
language sql stable security definer set search_path = public as $$
  select v.id, p.id, p.display_name,
    case when ps.show_age then p.age else null end,
    case when ps.show_university then p.university else null end,
    case when ps.show_course then p.course else null end,
    p.avatar_url, v.activity, v.caption, v.media_url, v.open_to_company, v.visibility,
    greatest(0, floor(extract(epoch from (now() - v.created_at)) / 60)::int),
    (select count(*) from public.vibe_reactions vr where vr.vibe_id = v.id),
    exists (select 1 from public.vibe_reactions vr where vr.vibe_id = v.id and vr.user_id = viewer_id), 100
  from public.vibes v
  join public.profiles p on p.id = v.user_id
  join public.privacy_settings ps on ps.user_id = p.id
  where viewer_id = auth.uid() and v.user_id = profile_user_id and not v.is_deleted and ps.appear_in_vibe
    and (v.user_id = viewer_id or v.visibility = 'public' or public.are_vibesmates(viewer_id, v.user_id))
  order by v.created_at desc
  limit least(greatest(result_limit, 1), 50);
$$;

create or replace function public.get_vibe_feed(viewer_id uuid, selected_vibe text default 'All', result_limit int default 30)
returns table (id uuid, author_id uuid, display_name text, age int, university text, course text, avatar_url text, activity text, caption text, media_url text, open_to_company boolean, visibility text, minutes_ago int, reaction_count bigint, reacted_by_viewer boolean, common_vibe_percent int)
language sql stable security definer set search_path = public as $$
  with viewer_interests as (
    select interest_id from public.user_interests where user_id = viewer_id
  ), shared_counts as (
    select ui.user_id, count(*)::int as shared_count
    from public.user_interests ui join viewer_interests vi on vi.interest_id = ui.interest_id
    group by ui.user_id
  )
  select v.id, p.id, p.display_name,
    case when ps.show_age then p.age else null end,
    case when ps.show_university then p.university else null end,
    case when ps.show_course then p.course else null end,
    p.avatar_url, v.activity, v.caption, v.media_url, v.open_to_company, v.visibility,
    greatest(0, floor(extract(epoch from (now() - v.created_at)) / 60)::int),
    count(vr.user_id), bool_or(vr.user_id = viewer_id),
    least(99, 58 + coalesce(sc.shared_count, 0) * 10 + case when p.university is not null and p.university = (select university from public.profiles where id = viewer_id) then 12 else 0 end)
  from public.vibes v
  join public.profiles p on p.id = v.user_id
  join public.privacy_settings ps on ps.user_id = p.id
  left join shared_counts sc on sc.user_id = p.id
  left join public.vibe_reactions vr on vr.vibe_id = v.id
  where viewer_id = auth.uid() and not v.is_deleted and ps.appear_in_vibe and v.user_id <> viewer_id
    and (v.visibility = 'public' or public.are_vibesmates(viewer_id, v.user_id))
    and not exists (select 1 from public.blocks b where b.blocker_id = viewer_id and b.blocked_id = v.user_id)
    and not exists (select 1 from public.blocks b where b.blocker_id = v.user_id and b.blocked_id = viewer_id)
    and (selected_vibe in ('All', '✨ All') or v.activity ilike '%' || selected_vibe || '%' or selected_vibe ilike '%' || v.activity || '%')
  group by v.id, p.id, ps.user_id, sc.shared_count
  order by v.created_at desc
  limit least(greatest(result_limit, 1), 50);
$$;

create or replace function public.get_conversations_for_user(viewer_id uuid)
returns table (id uuid, title text, last_message text, last_message_at timestamptz)
language sql stable security definer set search_path = public as $$
  select c.id,
    coalesce(string_agg(p.display_name, ', ') filter (where p.id <> viewer_id), 'Conversation'),
    coalesce((select m.body from public.messages m where m.conversation_id = c.id and not m.is_deleted order by m.created_at desc limit 1), 'No messages yet'),
    (select m.created_at from public.messages m where m.conversation_id = c.id and not m.is_deleted order by m.created_at desc limit 1)
  from public.conversations c
  join public.conversation_members self on self.conversation_id = c.id and self.user_id = viewer_id
  left join public.conversation_members other on other.conversation_id = c.id
  left join public.profiles p on p.id = other.user_id
  where viewer_id = auth.uid()
  group by c.id
  order by (select m.created_at from public.messages m where m.conversation_id = c.id and not m.is_deleted order by m.created_at desc limit 1) desc nulls last, c.created_at desc
  limit 50;
$$;
