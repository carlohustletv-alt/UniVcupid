alter table public.vibes
add column if not exists visibility text not null default 'public'
check (visibility in ('public', 'vibesmate'));

create table if not exists public.vibe_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  requested_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (requester_id, requested_id),
  check (requester_id <> requested_id)
);

create table if not exists public.vibesmates (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.profiles(id) on delete cascade,
  user_b uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_a, user_b),
  check (user_a <> user_b),
  check (user_a < user_b)
);

alter table public.vibe_requests enable row level security;
alter table public.vibesmates enable row level security;

drop policy if exists "vibe requests visible to members" on public.vibe_requests;
drop policy if exists "vibesmates visible to members" on public.vibesmates;

create policy "vibe requests visible to members" on public.vibe_requests
for select using (auth.uid() = requester_id or auth.uid() = requested_id);

create policy "vibesmates visible to members" on public.vibesmates
for select using (auth.uid() = user_a or auth.uid() = user_b);

create index if not exists vibe_requests_requested_idx on public.vibe_requests (requested_id, status, created_at desc);
create index if not exists vibe_requests_requester_idx on public.vibe_requests (requester_id, status, created_at desc);
create index if not exists vibesmates_user_a_idx on public.vibesmates (user_a);
create index if not exists vibesmates_user_b_idx on public.vibesmates (user_b);
create index if not exists vibes_visibility_created_idx on public.vibes (visibility, created_at desc);

create or replace function public.are_vibesmates(first_user uuid, second_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from vibesmates
    where user_a = least(first_user, second_user)
      and user_b = greatest(first_user, second_user)
  );
$$;

create or replace function public.ensure_conversation(first_user uuid, second_user uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  existing_conversation uuid;
  new_conversation uuid;
begin
  select cm1.conversation_id into existing_conversation
  from conversation_members cm1
  join conversation_members cm2 on cm2.conversation_id = cm1.conversation_id
  where cm1.user_id = first_user and cm2.user_id = second_user
  limit 1;

  if existing_conversation is not null then
    return existing_conversation;
  end if;

  insert into conversations default values returning id into new_conversation;
  insert into conversation_members (conversation_id, user_id)
  values (new_conversation, first_user), (new_conversation, second_user);
  return new_conversation;
end;
$$;

drop function if exists public.get_profile_vibes(uuid, uuid, int);
drop function if exists public.get_vibe_feed(uuid, text, int);

create function public.get_vibe_feed(
  viewer_id uuid,
  selected_vibe text default 'All',
  result_limit int default 30
) returns table (
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
  with viewer_interests as (
    select interest_id from user_interests where user_id = viewer_id
  ), shared_counts as (
    select ui.user_id, count(*)::int as shared_count
    from user_interests ui
    join viewer_interests vi on vi.interest_id = ui.interest_id
    group by ui.user_id
  )
  select
    v.id,
    p.id as author_id,
    p.display_name,
    case when ps.show_age then p.age else null end as age,
    case when ps.show_university then p.university else null end as university,
    case when ps.show_course then p.course else null end as course,
    p.avatar_url,
    v.activity,
    v.caption,
    v.media_url,
    v.open_to_company,
    v.visibility,
    greatest(0, floor(extract(epoch from (now() - v.created_at)) / 60)::int) as minutes_ago,
    count(vr.user_id) as reaction_count,
    bool_or(vr.user_id = viewer_id) as reacted_by_viewer,
    least(99, 58 + coalesce(sc.shared_count, 0) * 10 + case when p.university is not null and p.university = (select university from profiles where id = viewer_id) then 12 else 0 end) as common_vibe_percent
  from vibes v
  join profiles p on p.id = v.user_id
  join privacy_settings ps on ps.user_id = p.id
  left join shared_counts sc on sc.user_id = p.id
  left join vibe_reactions vr on vr.vibe_id = v.id
  where ps.appear_in_vibe
    and v.user_id <> viewer_id
    and (v.visibility = 'public' or public.are_vibesmates(viewer_id, v.user_id))
    and not exists (select 1 from blocks b where b.blocker_id = viewer_id and b.blocked_id = v.user_id)
    and not exists (select 1 from blocks b where b.blocker_id = v.user_id and b.blocked_id = viewer_id)
    and (selected_vibe in ('All', '✨ All') or v.activity ilike '%' || selected_vibe || '%' or selected_vibe ilike '%' || v.activity || '%')
  group by v.id, p.id, ps.user_id, sc.shared_count
  order by v.created_at desc
  limit least(greatest(result_limit, 1), 50);
$$;

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
  select * from public.get_vibe_feed(viewer_id, 'All', 50)
  where author_id = profile_user_id
  union all
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
    and v.user_id = viewer_id
  order by minutes_ago asc
  limit least(greatest(result_limit, 1), 50);
$$;

create or replace function public.get_profile_for_user(viewer_id uuid, profile_user_id uuid)
returns table (
  id uuid,
  display_name text,
  age int,
  university text,
  course text,
  avatar_url text,
  common_vibe_percent int,
  vibesmate_status text
) language sql stable security definer set search_path = public as $$
  select
    p.id,
    p.display_name,
    case when ps.show_age then p.age else null end,
    case when ps.show_university then p.university else null end,
    case when ps.show_course then p.course else null end,
    p.avatar_url,
    75,
    case
      when p.id = viewer_id then 'self'
      when public.are_vibesmates(viewer_id, p.id) then 'vibesmate'
      when exists (select 1 from vibe_requests vr where vr.requester_id = viewer_id and vr.requested_id = p.id and vr.status = 'pending') then 'sent'
      when exists (select 1 from vibe_requests vr where vr.requester_id = p.id and vr.requested_id = viewer_id and vr.status = 'pending') then 'incoming'
      else 'none'
    end
  from profiles p
  join privacy_settings ps on ps.user_id = p.id
  where p.id = profile_user_id;
$$;

create or replace function public.send_vibe_request(target_user uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  viewer uuid := auth.uid();
  reverse_request uuid;
  request_id uuid;
begin
  if viewer is null or viewer = target_user then raise exception 'not allowed'; end if;
  if public.are_vibesmates(viewer, target_user) then return public.ensure_conversation(viewer, target_user); end if;

  select id into reverse_request from vibe_requests
  where requester_id = target_user and requested_id = viewer and status = 'pending'
  limit 1;

  if reverse_request is not null then
    perform public.accept_vibe_request(reverse_request);
    return public.ensure_conversation(viewer, target_user);
  end if;

  insert into vibe_requests (requester_id, requested_id)
  values (viewer, target_user)
  on conflict (requester_id, requested_id) do update set status = 'pending', responded_at = null
  returning id into request_id;
  return request_id;
end;
$$;

create or replace function public.accept_vibe_request(request_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  viewer uuid := auth.uid();
  requester uuid;
  requested uuid;
begin
  select requester_id, requested_id into requester, requested
  from vibe_requests
  where id = request_id and status = 'pending';

  if requester is null or requested <> viewer then raise exception 'not allowed'; end if;

  update vibe_requests set status = 'accepted', responded_at = now() where id = request_id;
  insert into vibesmates (user_a, user_b)
  values (least(requester, requested), greatest(requester, requested))
  on conflict (user_a, user_b) do nothing;
  return public.ensure_conversation(requester, requested);
end;
$$;

create or replace function public.decline_vibe_request(request_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update vibe_requests set status = 'declined', responded_at = now()
  where id = request_id and requested_id = auth.uid() and status = 'pending';
end;
$$;

create or replace function public.get_incoming_vibe_requests(viewer_id uuid)
returns table (id uuid, requester_id uuid, display_name text, university text, course text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select vr.id, p.id, p.display_name, p.university, p.course, vr.created_at
  from vibe_requests vr
  join profiles p on p.id = vr.requester_id
  where vr.requested_id = viewer_id and vr.status = 'pending'
  order by vr.created_at desc;
$$;

create or replace function public.get_vibesmates(viewer_id uuid)
returns table (id uuid, display_name text, university text, course text)
language sql stable security definer set search_path = public as $$
  select p.id, p.display_name, p.university, p.course
  from vibesmates vm
  join profiles p on p.id = case when vm.user_a = viewer_id then vm.user_b else vm.user_a end
  where viewer_id in (vm.user_a, vm.user_b)
  order by vm.created_at desc;
$$;
