create or replace function public.provision_new_profile()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, age, university, course)
  values (new.id, coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'), ''), split_part(new.email, '@', 1), 'Member'), 18, nullif(trim(new.raw_user_meta_data->>'university'), ''), nullif(trim(new.raw_user_meta_data->>'course'), ''))
  on conflict (id) do nothing;
  insert into public.privacy_settings (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;
drop trigger if exists provision_profile_after_signup on auth.users;
create trigger provision_profile_after_signup after insert on auth.users for each row execute function public.provision_new_profile();
