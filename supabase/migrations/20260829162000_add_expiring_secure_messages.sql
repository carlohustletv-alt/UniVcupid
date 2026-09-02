alter table public.messages add column if not exists expires_at timestamptz;
update public.messages set expires_at = created_at + interval '1 day' where expires_at is null;
alter table public.messages alter column expires_at set default (now() + interval '1 day');
alter table public.messages alter column expires_at set not null;

drop policy if exists "messages readable by conversation members" on public.messages;
create policy "messages readable by conversation members" on public.messages for select using (not is_deleted and expires_at > now() and exists (select 1 from public.conversation_members cm where cm.conversation_id = messages.conversation_id and cm.user_id = auth.uid()));

create or replace function public.expire_old_messages()
returns void language sql security definer set search_path = public as $$
  update public.messages set is_deleted = true, deleted_at = now() where not is_deleted and expires_at <= now();
$$;
revoke all on function public.expire_old_messages() from public;

create or replace function public.get_conversations_for_user(viewer_id uuid)
returns table (id uuid, title text, last_message text, last_message_at timestamptz)
language sql stable security definer set search_path = public as $$
  select c.id, coalesce(string_agg(p.display_name, ', ') filter (where p.id <> viewer_id), 'Conversation'),
    coalesce((select m.body from public.messages m where m.conversation_id = c.id and not m.is_deleted and m.expires_at > now() order by m.created_at desc limit 1), 'No messages yet'),
    (select m.created_at from public.messages m where m.conversation_id = c.id and not m.is_deleted and m.expires_at > now() order by m.created_at desc limit 1)
  from public.conversations c join public.conversation_members self on self.conversation_id = c.id and self.user_id = viewer_id
  left join public.conversation_members other on other.conversation_id = c.id left join public.profiles p on p.id = other.user_id
  where viewer_id = auth.uid() group by c.id
  order by (select m.created_at from public.messages m where m.conversation_id = c.id and not m.is_deleted and m.expires_at > now() order by m.created_at desc limit 1) desc nulls last, c.created_at desc limit 50;
$$;
