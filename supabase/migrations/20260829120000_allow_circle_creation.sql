drop policy if exists "users create circles" on public.circles;
drop policy if exists "users update own circles" on public.circles;

create policy "users create circles" on public.circles
for insert with check (auth.uid() = created_by);

create policy "users update own circles" on public.circles
for update using (auth.uid() = created_by) with check (auth.uid() = created_by);

drop function if exists public.get_circles_for_user(uuid);

create function public.get_circles_for_user(viewer_id uuid)
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
