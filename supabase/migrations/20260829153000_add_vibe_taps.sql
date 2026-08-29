create table if not exists public.vibe_taps (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  code text not null unique,
  expires_at timestamptz not null,
  claimed_by uuid references public.profiles(id) on delete set null,
  claimed_at timestamptz
);
alter table public.vibe_taps enable row level security;

create or replace function public.create_vibe_tap()
returns table (code text, expires_at timestamptz) language plpgsql security definer set search_path = public as $$
declare new_code text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  delete from public.vibe_taps where creator_id = auth.uid() and (expires_at < now() or claimed_at is not null);
  new_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  insert into public.vibe_taps (creator_id, code, expires_at) values (auth.uid(), new_code, now() + interval '5 minutes');
  return query select new_code, now() + interval '5 minutes';
end; $$;

create or replace function public.claim_vibe_tap(tap_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare viewer uuid := auth.uid(); host uuid; tap_id uuid;
begin
  select id, creator_id into tap_id, host from public.vibe_taps where code = upper(trim(tap_code)) and expires_at > now() and claimed_at is null for update;
  if viewer is null or tap_id is null or host = viewer then raise exception 'This Vibe Tap is unavailable'; end if;
  if exists (select 1 from public.blocks b where (b.blocker_id = viewer and b.blocked_id = host) or (b.blocker_id = host and b.blocked_id = viewer)) then raise exception 'This Vibe Tap is unavailable'; end if;
  update public.vibe_taps set claimed_by = viewer, claimed_at = now() where id = tap_id;
  insert into public.vibesmates (user_a, user_b) values (least(viewer, host), greatest(viewer, host)) on conflict (user_a, user_b) do nothing;
  return public.ensure_conversation(viewer, host);
end; $$;

revoke all on function public.create_vibe_tap(), public.claim_vibe_tap(text) from public;
grant execute on function public.create_vibe_tap(), public.claim_vibe_tap(text) to authenticated;
