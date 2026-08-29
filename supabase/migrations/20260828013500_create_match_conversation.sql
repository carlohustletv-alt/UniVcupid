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
