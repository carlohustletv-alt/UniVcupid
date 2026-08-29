create table if not exists public.app_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'admin' check (role in ('admin', 'moderator')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references auth.users(id) on delete set null,
  target_user_id uuid references public.profiles(id) on delete set null,
  vibe_id uuid references public.vibes(id) on delete set null,
  circle_id uuid references public.circles(id) on delete set null,
  circle_post_id uuid references public.circle_posts(id) on delete set null,
  action text not null,
  reason text,
  created_at timestamptz not null default now()
);

alter table public.app_admins enable row level security;
alter table public.moderation_actions enable row level security;

create or replace function public.is_app_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.app_admins aa
    where aa.user_id = auth.uid() and aa.active = true
  );
$$;

drop policy if exists "admins read own admin status" on public.app_admins;
drop policy if exists "admins read moderation actions" on public.moderation_actions;

create policy "admins read own admin status" on public.app_admins
for select using (auth.uid() = user_id);

create policy "admins read moderation actions" on public.moderation_actions
for select using (public.is_app_admin());

create index if not exists app_admins_active_idx on public.app_admins (active, role);
create index if not exists moderation_actions_created_idx on public.moderation_actions (created_at desc);
create index if not exists reports_created_idx on public.reports (created_at desc);
create index if not exists reports_reported_user_idx on public.reports (reported_user_id, created_at desc);

create or replace function public.is_app_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.app_admins aa
    where aa.user_id = auth.uid() and aa.active = true
  );
$$;

create or replace function public.require_app_admin()
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_app_admin() then
    raise exception 'admin access required';
  end if;
end;
$$;

create or replace function public.admin_overview()
returns table (
  profiles bigint,
  vibes bigint,
  circles bigint,
  circle_posts bigint,
  reports_open bigint,
  vibe_requests_pending bigint,
  conversations bigint
) language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_app_admin();
  return query select
    (select count(*) from profiles),
    (select count(*) from vibes),
    (select count(*) from circles),
    (select count(*) from circle_posts),
    (select count(*) from reports where status = 'open'),
    (select count(*) from vibe_requests where status = 'pending'),
    (select count(*) from conversations);
end;
$$;

create or replace function public.admin_list_profiles(search_query text default '', result_limit int default 50)
returns table (
  id uuid,
  email text,
  display_name text,
  age int,
  university text,
  course text,
  created_at timestamptz,
  vibe_count bigint,
  circle_count bigint,
  report_count bigint
) language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_app_admin();
  return query
  select p.id, u.email, p.display_name, p.age, p.university, p.course, p.created_at,
    (select count(*) from vibes v where v.user_id = p.id),
    (select count(*) from circle_members cm where cm.user_id = p.id),
    (select count(*) from reports r where r.reported_user_id = p.id)
  from profiles p
  left join auth.users u on u.id = p.id
  where coalesce(trim(search_query), '') = ''
    or p.display_name ilike '%' || search_query || '%'
    or p.university ilike '%' || search_query || '%'
    or p.course ilike '%' || search_query || '%'
    or u.email ilike '%' || search_query || '%'
  order by p.created_at desc
  limit least(greatest(result_limit, 1), 100);
end;
$$;

create or replace function public.admin_list_vibes(search_query text default '', result_limit int default 50)
returns table (
  id uuid,
  user_id uuid,
  display_name text,
  activity text,
  caption text,
  media_url text,
  visibility text,
  created_at timestamptz,
  reaction_count bigint
) language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_app_admin();
  return query
  select v.id, v.user_id, p.display_name, v.activity, v.caption, v.media_url, v.visibility, v.created_at,
    (select count(*) from vibe_reactions vr where vr.vibe_id = v.id)
  from vibes v
  join profiles p on p.id = v.user_id
  where coalesce(trim(search_query), '') = ''
    or p.display_name ilike '%' || search_query || '%'
    or v.activity ilike '%' || search_query || '%'
    or v.caption ilike '%' || search_query || '%'
  order by v.created_at desc
  limit least(greatest(result_limit, 1), 100);
end;
$$;

create or replace function public.admin_list_circles(search_query text default '', result_limit int default 50)
returns table (
  id uuid,
  name text,
  icon text,
  description text,
  campus text,
  created_by uuid,
  created_at timestamptz,
  member_count bigint,
  post_count bigint
) language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_app_admin();
  return query
  select c.id, c.name, c.icon, c.description, c.campus, c.created_by, c.created_at,
    (select count(*) from circle_members cm where cm.circle_id = c.id),
    (select count(*) from circle_posts cp where cp.circle_id = c.id)
  from circles c
  where coalesce(trim(search_query), '') = ''
    or c.name ilike '%' || search_query || '%'
    or c.description ilike '%' || search_query || '%'
    or c.campus ilike '%' || search_query || '%'
  order by c.created_at desc
  limit least(greatest(result_limit, 1), 100);
end;
$$;

create or replace function public.admin_list_reports(status_filter text default 'open', result_limit int default 50)
returns table (
  id uuid,
  reporter_id uuid,
  reporter_name text,
  reported_user_id uuid,
  reported_name text,
  vibe_id uuid,
  reason text,
  details text,
  status text,
  created_at timestamptz
) language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_app_admin();
  return query
  select r.id, r.reporter_id, reporter.display_name, r.reported_user_id, reported.display_name,
    r.vibe_id, r.reason, r.details, r.status, r.created_at
  from reports r
  left join profiles reporter on reporter.id = r.reporter_id
  left join profiles reported on reported.id = r.reported_user_id
  where status_filter = 'all' or r.status = status_filter
  order by r.created_at desc
  limit least(greatest(result_limit, 1), 100);
end;
$$;

create or replace function public.admin_update_report_status(report_id uuid, new_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.require_app_admin();
  if new_status not in ('open', 'reviewing', 'resolved', 'dismissed') then
    raise exception 'invalid report status';
  end if;
  update reports set status = new_status where id = report_id;
  insert into moderation_actions (admin_id, action, reason)
  values (auth.uid(), 'report_status:' || new_status, report_id::text);
end;
$$;

create or replace function public.admin_delete_vibe(vibe_id uuid, reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare target_user uuid;
begin
  perform public.require_app_admin();
  select user_id into target_user from vibes where id = vibe_id;
  delete from vibes where id = vibe_id;
  insert into moderation_actions (admin_id, target_user_id, vibe_id, action, reason)
  values (auth.uid(), target_user, vibe_id, 'delete_vibe', reason);
end;
$$;

create or replace function public.admin_delete_circle(circle_id uuid, reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.require_app_admin();
  delete from circles where id = circle_id;
  insert into moderation_actions (admin_id, circle_id, action, reason)
  values (auth.uid(), circle_id, 'delete_circle', reason);
end;
$$;

create or replace function public.admin_suspend_profile(target_user uuid, reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.require_app_admin();
  update privacy_settings
  set appear_in_cupid = false, appear_in_vibe = false, allow_dms = false
  where user_id = target_user;
  insert into moderation_actions (admin_id, target_user_id, action, reason)
  values (auth.uid(), target_user, 'suspend_profile_visibility', reason);
end;
$$;
