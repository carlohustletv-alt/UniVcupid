create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  age int not null check (age >= 18),
  university text,
  course text,
  bio text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.privacy_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  show_university boolean not null default true,
  show_course boolean not null default true,
  show_age boolean not null default true,
  show_online_status boolean not null default true,
  allow_dms boolean not null default true,
  show_activities boolean not null default true,
  appear_in_cupid boolean not null default true,
  appear_in_vibe boolean not null default true
);

create table if not exists public.interests (
  id bigint generated always as identity primary key,
  name text not null unique,
  icon text not null default '✦'
);

create table if not exists public.user_interests (
  user_id uuid references public.profiles(id) on delete cascade,
  interest_id bigint references public.interests(id) on delete cascade,
  primary key (user_id, interest_id)
);

create table if not exists public.vibes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  activity text not null,
  caption text,
  media_url text,
  visibility text not null default 'public' check (visibility in ('public', 'vibesmate')),
  open_to_company boolean not null default false,
  campus text,
  created_at timestamptz not null default now()
);

alter table public.vibes
add column if not exists visibility text not null default 'public'
check (visibility in ('public', 'vibesmate'));

create table if not exists public.vibe_reactions (
  vibe_id uuid references public.vibes(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  reaction text not null,
  created_at timestamptz not null default now(),
  primary key (vibe_id, user_id)
);

create table if not exists public.circles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  icon text not null default '◌',
  description text,
  campus text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.circle_members (
  circle_id uuid references public.circles(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (circle_id, user_id)
);

create table if not exists public.circle_posts (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (length(trim(body)) > 0),
  prompt text,
  media_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.circle_post_reactions (
  post_id uuid not null references public.circle_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reaction text not null default 'hype',
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.likes (
  liker_id uuid references public.profiles(id) on delete cascade,
  liked_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (liker_id, liked_id),
  check (liker_id <> liked_id)
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.profiles(id) on delete cascade,
  user_b uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_a, user_b),
  check (user_a <> user_b)
);

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

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table if not exists public.conversation_members (
  conversation_id uuid references public.conversations(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  primary key (conversation_id, user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.blocks (
  blocker_id uuid references public.profiles(id) on delete cascade,
  blocked_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles(id) on delete set null,
  reported_user_id uuid references public.profiles(id) on delete set null,
  vibe_id uuid references public.vibes(id) on delete set null,
  reason text not null,
  details text,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.privacy_settings enable row level security;
alter table public.vibes enable row level security;
alter table public.vibe_reactions enable row level security;
alter table public.circles enable row level security;
alter table public.circle_members enable row level security;
alter table public.circle_posts enable row level security;
alter table public.circle_post_reactions enable row level security;
alter table public.likes enable row level security;
alter table public.matches enable row level security;
alter table public.vibe_requests enable row level security;
alter table public.vibesmates enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.blocks enable row level security;
alter table public.reports enable row level security;

create policy "public profiles are readable" on public.profiles for select using (true);
create policy "users update own profile" on public.profiles for update using (auth.uid() = id);
create policy "users insert own profile" on public.profiles for insert with check (auth.uid() = id);

create policy "users manage own privacy" on public.privacy_settings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "vibes readable when visible to viewer" on public.vibes for select using (exists (select 1 from public.privacy_settings ps where ps.user_id = vibes.user_id and ps.appear_in_vibe) and (visibility = 'public' or user_id = auth.uid() or public.are_vibesmates(auth.uid(), user_id)));
create policy "users manage own vibes" on public.vibes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users react as self" on public.vibe_reactions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "circles readable" on public.circles for select using (true);
create policy "users create circles" on public.circles for insert with check (auth.uid() = created_by);
create policy "users update own circles" on public.circles for update using (auth.uid() = created_by) with check (auth.uid() = created_by);
create policy "memberships as self" on public.circle_members for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "circle posts readable by members" on public.circle_posts for select using (exists (select 1 from public.circle_members cm where cm.circle_id = circle_posts.circle_id and cm.user_id = auth.uid()));
create policy "circle members create posts" on public.circle_posts for insert with check (auth.uid() = user_id and exists (select 1 from public.circle_members cm where cm.circle_id = circle_posts.circle_id and cm.user_id = auth.uid()));
create policy "circle post reactions by members" on public.circle_post_reactions for all using (auth.uid() = user_id and exists (select 1 from public.circle_posts cp join public.circle_members cm on cm.circle_id = cp.circle_id where cp.id = circle_post_reactions.post_id and cm.user_id = auth.uid())) with check (auth.uid() = user_id and exists (select 1 from public.circle_posts cp join public.circle_members cm on cm.circle_id = cp.circle_id where cp.id = circle_post_reactions.post_id and cm.user_id = auth.uid()));
create policy "likes as self" on public.likes for all using (auth.uid() = liker_id) with check (auth.uid() = liker_id);
create policy "matches readable by members" on public.matches for select using (auth.uid() = user_a or auth.uid() = user_b);
create policy "vibe requests visible to members" on public.vibe_requests for select using (auth.uid() = requester_id or auth.uid() = requested_id);
create policy "vibesmates visible to members" on public.vibesmates for select using (auth.uid() = user_a or auth.uid() = user_b);
create policy "conversation members readable by self" on public.conversation_members for select using (auth.uid() = user_id);
create policy "messages readable by conversation members" on public.messages for select using (exists (select 1 from public.conversation_members cm where cm.conversation_id = messages.conversation_id and cm.user_id = auth.uid()));
create policy "messages sent by conversation members" on public.messages for insert with check (auth.uid() = sender_id and exists (select 1 from public.conversation_members cm where cm.conversation_id = messages.conversation_id and cm.user_id = auth.uid()));
create policy "blocks as self" on public.blocks for all using (auth.uid() = blocker_id) with check (auth.uid() = blocker_id);
create policy "reports sent by self" on public.reports for insert with check (auth.uid() = reporter_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vibe-media', 'vibe-media', true, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true;

create policy "vibe media is publicly readable" on storage.objects
for select using (bucket_id = 'vibe-media');

create policy "users upload own vibe media" on storage.objects
for insert with check (bucket_id = 'vibe-media' and auth.role() = 'authenticated' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "users update own vibe media" on storage.objects
for update using (bucket_id = 'vibe-media' and auth.role() = 'authenticated' and auth.uid()::text = (storage.foldername(name))[1])
with check (bucket_id = 'vibe-media' and auth.role() = 'authenticated' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "users delete own vibe media" on storage.objects
for delete using (bucket_id = 'vibe-media' and auth.role() = 'authenticated' and auth.uid()::text = (storage.foldername(name))[1]);

create index if not exists profiles_university_idx on public.profiles (university);
create index if not exists profiles_created_at_idx on public.profiles (created_at desc);
create index if not exists profiles_age_created_idx on public.profiles (age, created_at desc);
create index if not exists privacy_appear_in_vibe_idx on public.privacy_settings (appear_in_vibe) where appear_in_vibe = true;
create index if not exists privacy_cupid_user_idx on public.privacy_settings (appear_in_cupid, user_id) where appear_in_cupid = true;
create index if not exists vibes_created_at_idx on public.vibes (created_at desc);
create index if not exists vibes_activity_created_at_idx on public.vibes (activity, created_at desc);
create index if not exists vibes_user_created_at_idx on public.vibes (user_id, created_at desc);
create index if not exists vibes_public_created_idx on public.vibes (created_at desc) where visibility = 'public';
create index if not exists vibe_reactions_vibe_idx on public.vibe_reactions (vibe_id);
create index if not exists circle_members_user_idx on public.circle_members (user_id);
create index if not exists circle_members_circle_idx on public.circle_members (circle_id);
create index if not exists circle_posts_circle_created_idx on public.circle_posts (circle_id, created_at desc);
create index if not exists circle_post_reactions_post_idx on public.circle_post_reactions (post_id);
create index if not exists likes_liked_idx on public.likes (liked_id, liker_id);
create index if not exists vibe_requests_requested_idx on public.vibe_requests (requested_id, status, created_at desc);
create index if not exists vibe_requests_requester_idx on public.vibe_requests (requester_id, status, created_at desc);
create index if not exists vibesmates_user_a_idx on public.vibesmates (user_a);
create index if not exists vibesmates_user_b_idx on public.vibesmates (user_b);
create index if not exists vibes_visibility_created_idx on public.vibes (visibility, created_at desc);
create index if not exists messages_conversation_created_idx on public.messages (conversation_id, created_at desc);
create index if not exists messages_conversation_created_asc_idx on public.messages (conversation_id, created_at asc);
create index if not exists reports_status_created_idx on public.reports (status, created_at desc);

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

  if existing_conversation is not null then return existing_conversation; end if;

  insert into conversations default values returning id into new_conversation;
  insert into conversation_members (conversation_id, user_id)
  values (new_conversation, first_user), (new_conversation, second_user);
  return new_conversation;
end;
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

create or replace function public.get_profile_for_user(viewer_id uuid, profile_user_id uuid)
returns table (id uuid, display_name text, age int, university text, course text, avatar_url text, common_vibe_percent int, vibesmate_status text)
language sql stable security definer set search_path = public as $$
  select p.id, p.display_name,
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

create or replace function public.accept_vibe_request(request_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  viewer uuid := auth.uid();
  requester uuid;
  requested uuid;
begin
  select requester_id, requested_id into requester, requested from vibe_requests where id = request_id and status = 'pending';
  if requester is null or requested <> viewer then raise exception 'not allowed'; end if;
  update vibe_requests set status = 'accepted', responded_at = now() where id = request_id;
  insert into vibesmates (user_a, user_b) values (least(requester, requested), greatest(requester, requested)) on conflict (user_a, user_b) do nothing;
  return public.ensure_conversation(requester, requested);
end;
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
  select id into reverse_request from vibe_requests where requester_id = target_user and requested_id = viewer and status = 'pending' limit 1;
  if reverse_request is not null then perform public.accept_vibe_request(reverse_request); return public.ensure_conversation(viewer, target_user); end if;
  insert into vibe_requests (requester_id, requested_id) values (viewer, target_user)
  on conflict (requester_id, requested_id) do update set status = 'pending', responded_at = null
  returning id into request_id;
  return request_id;
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

create or replace function public.get_vibe_feed(
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

create or replace function public.get_circles_for_user(viewer_id uuid)
returns table (
  id uuid,
  name text,
  icon text,
  description text,
  campus text,
  active_count bigint,
  joined boolean
) language sql stable security definer set search_path = public as $$
  select
    c.id,
    c.name,
    c.icon,
    c.description,
    c.campus,
    count(cm.user_id) as active_count,
    exists (select 1 from circle_members mine where mine.circle_id = c.id and mine.user_id = viewer_id) as joined
  from circles c
  left join circle_members cm on cm.circle_id = c.id
  group by c.id
  order by active_count desc, c.created_at desc
  limit 100;
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

create or replace function public.get_circle_posts(viewer_id uuid, target_circle_id uuid, result_limit int default 50)
returns table (
  id uuid,
  circle_id uuid,
  author_id uuid,
  display_name text,
  university text,
  course text,
  body text,
  prompt text,
  media_url text,
  minutes_ago int,
  reaction_count bigint,
  reacted_by_viewer boolean
) language sql stable security definer set search_path = public as $$
  select
    cp.id,
    cp.circle_id,
    p.id as author_id,
    p.display_name,
    p.university,
    p.course,
    cp.body,
    cp.prompt,
    cp.media_url,
    greatest(0, floor(extract(epoch from (now() - cp.created_at)) / 60)::int) as minutes_ago,
    count(cpr.user_id) as reaction_count,
    bool_or(cpr.user_id = viewer_id) as reacted_by_viewer
  from circle_posts cp
  join profiles p on p.id = cp.user_id
  left join circle_post_reactions cpr on cpr.post_id = cp.id
  where cp.circle_id = target_circle_id
    and exists (select 1 from circle_members cm where cm.circle_id = target_circle_id and cm.user_id = viewer_id)
  group by cp.id, p.id
  order by cp.created_at desc
  limit least(greatest(result_limit, 1), 100);
$$;

create or replace function public.get_cupid_candidates(viewer_id uuid, result_limit int default 20)
returns table (
  id uuid,
  display_name text,
  age int,
  university text,
  course text,
  avatar_url text,
  common_vibe_percent int
) language sql stable security definer set search_path = public as $$
  with viewer_interests as (
    select interest_id from user_interests where user_id = viewer_id
  ), shared_counts as (
    select ui.user_id, count(*)::int as shared_count
    from user_interests ui
    join viewer_interests vi on vi.interest_id = ui.interest_id
    group by ui.user_id
  ), viewer_profile as (
    select university from profiles where id = viewer_id
  )
  select
    p.id,
    p.display_name,
    case when ps.show_age then p.age else null end as age,
    case when ps.show_university then p.university else null end as university,
    case when ps.show_course then p.course else null end as course,
    p.avatar_url,
    least(99, 55 + coalesce(sc.shared_count, 0) * 11 + case when p.university = (select university from viewer_profile) then 15 else 0 end) as common_vibe_percent
  from profiles p
  join privacy_settings ps on ps.user_id = p.id
  left join shared_counts sc on sc.user_id = p.id
  where p.id <> viewer_id
    and p.age >= 18
    and ps.appear_in_cupid
    and not exists (select 1 from likes l where l.liker_id = viewer_id and l.liked_id = p.id)
    and not exists (select 1 from blocks b where b.blocker_id = viewer_id and b.blocked_id = p.id)
    and not exists (select 1 from blocks b where b.blocker_id = p.id and b.blocked_id = viewer_id)
  order by common_vibe_percent desc, p.created_at desc
  limit least(greatest(result_limit, 1), 50);
$$;

create or replace function public.get_conversations_for_user(viewer_id uuid)
returns table (
  id uuid,
  title text,
  last_message text,
  last_message_at timestamptz
) language sql stable security definer set search_path = public as $$
  select
    c.id,
    coalesce(string_agg(p.display_name, ', ') filter (where p.id <> viewer_id), 'Conversation') as title,
    coalesce((select m.body from messages m where m.conversation_id = c.id order by m.created_at desc limit 1), 'No messages yet') as last_message,
    (select m.created_at from messages m where m.conversation_id = c.id order by m.created_at desc limit 1) as last_message_at
  from conversations c
  join conversation_members self on self.conversation_id = c.id and self.user_id = viewer_id
  left join conversation_members other on other.conversation_id = c.id
  left join profiles p on p.id = other.user_id
  group by c.id
  order by last_message_at desc nulls last, c.created_at desc
  limit 50;
$$;

create or replace function public.create_match_conversation(first_user uuid, second_user uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  user_a_id uuid := least(first_user, second_user);
  user_b_id uuid := greatest(first_user, second_user);
  existing_conversation uuid;
  new_conversation uuid;
begin
  if auth.uid() is null or auth.uid() not in (first_user, second_user) then
    raise exception 'not allowed';
  end if;

  if not exists (select 1 from likes where liker_id = first_user and liked_id = second_user)
    or not exists (select 1 from likes where liker_id = second_user and liked_id = first_user) then
    raise exception 'mutual likes required';
  end if;

  insert into matches (user_a, user_b)
  values (user_a_id, user_b_id)
  on conflict (user_a, user_b) do nothing;

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

-- =========================================================
-- MANAGEMENT & MODERATION TABLES AND SECURITY RPCS
-- =========================================================

create table if not exists public.app_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'admin' check (role in ('admin', 'moderator')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references auth.users(id) on delete set null,
  target_user_id uuid references public.profiles(id) on delete set null,
  vibe_id uuid references public.vibes(id) on delete set null,
  circle_id uuid references public.circles(id) on delete set null,
  circle_post_id uuid references public.circle_posts(id) on delete set null,
  action text not null,
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.campus_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  campus text not null default 'all',
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.app_admins enable row level security;
alter table public.moderation_actions enable row level security;
alter table public.campus_announcements enable row level security;

create policy "admins read own admin status" on public.app_admins
for select using (auth.uid() = user_id);

create policy "admins read moderation actions" on public.moderation_actions
for select using (public.is_app_admin());

create policy "public read active announcements" on public.campus_announcements
for select using (active = true);

create policy "admins manage announcements" on public.campus_announcements
for all using (public.is_app_admin()) with check (public.is_app_admin());

create or replace function public.is_app_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.app_admins aa
    where aa.user_id = auth.uid() and aa.active = true
  );
$$;

create or replace function public.require_app_admin()
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_app_admin() then
    raise exception 'admin access required';
  end if;
end;
$$;

