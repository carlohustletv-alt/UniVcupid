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

alter table public.circle_posts enable row level security;
alter table public.circle_post_reactions enable row level security;

drop policy if exists "circle posts readable by members" on public.circle_posts;
drop policy if exists "circle members create posts" on public.circle_posts;
drop policy if exists "circle post reactions by members" on public.circle_post_reactions;

create policy "circle posts readable by members" on public.circle_posts
for select using (
  exists (select 1 from public.circle_members cm where cm.circle_id = circle_posts.circle_id and cm.user_id = auth.uid())
);

create policy "circle members create posts" on public.circle_posts
for insert with check (
  auth.uid() = user_id
  and exists (select 1 from public.circle_members cm where cm.circle_id = circle_posts.circle_id and cm.user_id = auth.uid())
);

create policy "circle post reactions by members" on public.circle_post_reactions
for all using (
  auth.uid() = user_id
  and exists (
    select 1
    from public.circle_posts cp
    join public.circle_members cm on cm.circle_id = cp.circle_id
    where cp.id = circle_post_reactions.post_id and cm.user_id = auth.uid()
  )
) with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.circle_posts cp
    join public.circle_members cm on cm.circle_id = cp.circle_id
    where cp.id = circle_post_reactions.post_id and cm.user_id = auth.uid()
  )
);

create index if not exists circle_posts_circle_created_idx on public.circle_posts (circle_id, created_at desc);
create index if not exists circle_post_reactions_post_idx on public.circle_post_reactions (post_id);

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
