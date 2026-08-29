do $$
declare
  verification_conversation uuid := 'd3837b6c-7bac-4b64-be0e-5546b1dffd13';
  first_member uuid;
  second_member uuid;
begin
  select user_id
  into first_member
  from conversation_members
  where conversation_id = verification_conversation
  order by user_id
  limit 1;

  select user_id
  into second_member
  from conversation_members
  where conversation_id = verification_conversation
  order by user_id desc
  limit 1;

  if first_member is not null and second_member is not null then
    delete from matches
    where user_a = first_member and user_b = second_member;
  end if;

  delete from messages where conversation_id = verification_conversation;
  delete from conversation_members where conversation_id = verification_conversation;
  delete from conversations where id = verification_conversation;
end;
$$;
