create table if not exists public.circle_comments (
  id uuid primary key default gen_random_uuid(),
  circle_post_id uuid not null references public.circle_posts(id) on delete cascade,
  parent_id uuid references public.circle_comments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 500),
  created_at timestamptz not null default now(),
  is_deleted boolean not null default false
);
alter table public.circle_comments enable row level security;
create policy "circle members read comments" on public.circle_comments for select using (not is_deleted and exists (select 1 from public.circle_posts p join public.circle_members cm on cm.circle_id = p.circle_id where p.id = circle_comments.circle_post_id and cm.user_id = auth.uid()));
create policy "circle members write comments" on public.circle_comments for insert with check (user_id = auth.uid() and exists (select 1 from public.circle_posts p join public.circle_members cm on cm.circle_id = p.circle_id where p.id = circle_comments.circle_post_id and cm.user_id = auth.uid()));
create index if not exists circle_comments_post_created_idx on public.circle_comments (circle_post_id, created_at);

create or replace function public.get_circle_comments(target_post uuid)
returns table (id uuid, parent_id uuid, author_id uuid, display_name text, body text, minutes_ago int) language sql stable security definer set search_path = public as $$
  select c.id, c.parent_id, p.id, p.display_name, c.body, greatest(0, floor(extract(epoch from(now()-c.created_at))/60)::int)
  from public.circle_comments c join public.profiles p on p.id = c.user_id join public.circle_posts cp on cp.id = c.circle_post_id
  where c.circle_post_id = target_post and not c.is_deleted and exists (select 1 from public.circle_members cm where cm.circle_id = cp.circle_id and cm.user_id = auth.uid()) order by c.created_at;
$$;
revoke all on function public.get_circle_comments(uuid) from public;
grant execute on function public.get_circle_comments(uuid) to authenticated;
