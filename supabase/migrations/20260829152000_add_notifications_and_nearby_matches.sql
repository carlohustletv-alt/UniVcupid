create table if not exists public.user_locations (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  vibe_id uuid references public.vibes(id) on delete cascade,
  kind text not null check (kind in ('vibe_reaction', 'nearby_match')),
  created_at timestamptz not null default now(),
  dedupe_key text unique
);

alter table public.user_locations enable row level security;
alter table public.app_notifications enable row level security;
create policy "users manage own location" on public.user_locations for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users read own notifications" on public.app_notifications for select using (recipient_id = auth.uid());

create or replace function public.notify_vibe_reaction() returns trigger language plpgsql security definer set search_path = public as $$
declare host uuid;
begin
  select user_id into host from public.vibes where id = new.vibe_id;
  if host is not null and host <> new.user_id then
    insert into public.app_notifications (recipient_id, actor_id, vibe_id, kind)
    values (host, new.user_id, new.vibe_id, 'vibe_reaction');
  end if;
  return new;
end; $$;
drop trigger if exists vibe_reaction_notification on public.vibe_reactions;
create trigger vibe_reaction_notification after insert on public.vibe_reactions for each row execute function public.notify_vibe_reaction();

create or replace function public.update_my_location(p_latitude double precision, p_longitude double precision)
returns void language plpgsql security definer set search_path = public as $$
declare viewer uuid := auth.uid(); other uuid; distance_km double precision;
begin
  if viewer is null then raise exception 'not authenticated'; end if;
  insert into public.user_locations (user_id, latitude, longitude) values (viewer, p_latitude, p_longitude)
  on conflict (user_id) do update set latitude = excluded.latitude, longitude = excluded.longitude, enabled = true, updated_at = now();
  for other in select case when m.user_a = viewer then m.user_b else m.user_a end from public.matches m where viewer in (m.user_a, m.user_b) loop
    select 6371 * acos(least(1, cos(radians(p_latitude)) * cos(radians(l.latitude)) * cos(radians(l.longitude) - radians(p_longitude)) + sin(radians(p_latitude)) * sin(radians(l.latitude)))) into distance_km from public.user_locations l where l.user_id = other and l.enabled and l.updated_at > now() - interval '15 minutes';
    if distance_km is not null and distance_km <= 1 then insert into public.app_notifications (recipient_id, actor_id, kind, dedupe_key) values (viewer, other, 'nearby_match', 'nearby:' || viewer || ':' || other || ':' || current_date) on conflict (dedupe_key) do nothing; end if;
  end loop;
end; $$;

create or replace function public.get_my_notifications()
returns table (id uuid, title text, body text, notification_count int) language sql stable security definer set search_path = public as $$
  select (array_agg(n.id order by n.created_at desc))[1],
    case when n.kind = 'vibe_reaction' then 'New Vibe reactions' else 'Cupid match nearby' end,
    case when n.kind = 'vibe_reaction' then coalesce(string_agg(distinct p.display_name, ', '), 'Someone') || ' reacted to your Vibe' else coalesce(max(p.display_name), 'A Cupid match') || ' is within 1 km' end,
    count(*)::int
  from public.app_notifications n left join public.profiles p on p.id = n.actor_id
  where n.recipient_id = auth.uid() group by n.kind, n.vibe_id order by max(n.created_at) desc limit 50;
$$;
create or replace function public.clear_my_notifications() returns void language sql security definer set search_path = public as $$ delete from public.app_notifications where recipient_id = auth.uid(); $$;
revoke all on function public.update_my_location(double precision, double precision), public.get_my_notifications(), public.clear_my_notifications() from public;
grant execute on function public.update_my_location(double precision, double precision), public.get_my_notifications(), public.clear_my_notifications() to authenticated;
