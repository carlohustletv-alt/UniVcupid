alter table public.circle_members add column if not exists role text not null default 'member' check (role in ('owner', 'moderator', 'member'));
alter table public.circle_posts add column if not exists pinned_at timestamptz;
alter table public.circle_posts add column if not exists pinned_by uuid references public.profiles(id) on delete set null;
update public.circle_members cm set role = 'owner' from public.circles c where c.id = cm.circle_id and c.created_by = cm.user_id;

create table if not exists public.vibe_events (
  vibe_id uuid primary key references public.vibes(id) on delete cascade,
  starts_at timestamptz not null,
  venue text not null check (length(trim(venue)) between 2 and 160),
  capacity int check (capacity is null or capacity between 1 and 500)
);
alter table public.vibe_events enable row level security;
create policy "visible vibes expose events" on public.vibe_events for select using (exists (select 1 from public.vibes v where v.id = vibe_events.vibe_id and v.user_id = auth.uid() or v.id = vibe_events.vibe_id and v.visibility = 'public'));

create or replace function public.update_my_profile(p_bio text, p_interest_ids bigint[] default '{}')
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  update public.profiles set bio = nullif(trim(p_bio), '') where id = auth.uid();
  delete from public.user_interests where user_id = auth.uid();
  insert into public.user_interests (user_id, interest_id) select auth.uid(), id from public.interests where id = any(p_interest_ids);
end; $$;

create or replace function public.set_circle_post_pinned(target_post uuid, is_pinned boolean)
returns void language plpgsql security definer set search_path = public as $$
declare target_circle uuid;
begin
  select circle_id into target_circle from public.circle_posts where id = target_post;
  if not exists (select 1 from public.circle_members where circle_id = target_circle and user_id = auth.uid() and role in ('owner', 'moderator')) then raise exception 'moderator access required'; end if;
  update public.circle_posts set pinned_at = case when is_pinned then now() else null end, pinned_by = case when is_pinned then auth.uid() else null end where id = target_post;
end; $$;

revoke all on function public.update_my_profile(text, bigint[]), public.set_circle_post_pinned(uuid, boolean) from public;
grant execute on function public.update_my_profile(text, bigint[]), public.set_circle_post_pinned(uuid, boolean) to authenticated;
