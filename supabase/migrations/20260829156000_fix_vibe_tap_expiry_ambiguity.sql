create or replace function public.create_vibe_tap()
returns table (code text, expires_at timestamptz) language plpgsql security definer set search_path = public as $$
declare new_code text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  delete from public.vibe_taps vt where vt.creator_id = auth.uid() and (vt.expires_at < now() or vt.claimed_at is not null);
  new_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  insert into public.vibe_taps (creator_id, code, expires_at) values (auth.uid(), new_code, now() + interval '5 minutes');
  return query select new_code, now() + interval '5 minutes';
end;
$$;
