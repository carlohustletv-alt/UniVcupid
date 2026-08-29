do $$
begin
  delete from auth.users
  where email like '%.demo@univcupid.test'
     or email like '%@univcupid.test';

  delete from circles
  where name in (
    'Kapehan Study Tambayan',
    'Pinoy Gamers Circle',
    'UAAP Watch Party',
    'OPM Open Mic',
    'Food Trip Barkada'
  );

  delete from interests i
  where not exists (
    select 1 from user_interests ui where ui.interest_id = i.id
  );

  delete from conversations c
  where not exists (
    select 1 from conversation_members cm where cm.conversation_id = c.id
  );
end;
$$;
