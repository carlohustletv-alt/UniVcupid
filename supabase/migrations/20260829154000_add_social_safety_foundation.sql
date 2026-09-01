-- Authoritative controls used by the next social features.
alter table public.conversation_members add column if not exists last_read_at timestamptz;
alter table public.user_locations add column if not exists expires_at timestamptz;
alter table public.profiles add column if not exists verification_status text not null default 'unverified' check (verification_status in ('unverified', 'pending', 'verified', 'rejected'));
alter table public.profiles add column if not exists verification_requested_at timestamptz;

alter table public.user_interests enable row level security;
create policy "users manage own interests" on public.user_interests for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.set_block(target_user uuid, is_blocked boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or target_user = auth.uid() then raise exception 'not allowed'; end if;
  if is_blocked then insert into public.blocks (blocker_id, blocked_id) values (auth.uid(), target_user) on conflict do nothing;
  else delete from public.blocks where blocker_id = auth.uid() and blocked_id = target_user;
  end if;
end; $$;

create or replace function public.disable_my_location()
returns void language sql security definer set search_path = public as $$
  update public.user_locations set enabled = false, expires_at = now() where user_id = auth.uid();
$$;

create or replace function public.mark_conversation_read(target_conversation uuid)
returns void language sql security definer set search_path = public as $$
  update public.conversation_members set last_read_at = now() where conversation_id = target_conversation and user_id = auth.uid();
$$;

revoke all on function public.set_block(uuid, boolean), public.disable_my_location(), public.mark_conversation_read(uuid) from public;
grant execute on function public.set_block(uuid, boolean), public.disable_my_location(), public.mark_conversation_read(uuid) to authenticated;
