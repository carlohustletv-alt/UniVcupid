-- =========================================================
-- UNIVCUPID COMPLETE MANAGEMENT ADMIN SUITE MIGRATION
-- Adds full admin operations, audit logging, circle management,
-- user profile editing, post moderation, and campus announcements
-- =========================================================

-- 1. Campus Announcements Table
create table if not exists public.campus_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  campus text not null default 'all',
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.campus_announcements enable row level security;

create policy "public read active announcements" on public.campus_announcements
for select using (active = true);

create policy "admins manage announcements" on public.campus_announcements
for all using (public.is_app_admin()) with check (public.is_app_admin());

create index if not exists campus_announcements_created_idx on public.campus_announcements (created_at desc);

-- 2. Enhanced Admin Overview with Activity Distributions
create or replace function public.admin_overview()
returns table (
  profiles bigint,
  vibes bigint,
  circles bigint,
  circle_posts bigint,
  reports_open bigint,
  reports_resolved bigint,
  vibe_requests_pending bigint,
  conversations bigint,
  moderation_count bigint
) language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_app_admin();
  return query select
    (select count(*) from profiles),
    (select count(*) from vibes),
    (select count(*) from circles),
    (select count(*) from circle_posts),
    (select count(*) from reports where status = 'open'),
    (select count(*) from reports where status = 'resolved'),
    (select count(*) from vibe_requests where status = 'pending'),
    (select count(*) from conversations),
    (select count(*) from moderation_actions);
end;
$$;

-- 3. Detailed Profile Inspection
create or replace function public.admin_get_profile_detail(target_user uuid)
returns table (
  id uuid,
  email text,
  display_name text,
  age int,
  university text,
  course text,
  bio text,
  avatar_url text,
  created_at timestamptz,
  show_university boolean,
  show_course boolean,
  show_age boolean,
  show_online_status boolean,
  allow_dms boolean,
  appear_in_cupid boolean,
  appear_in_vibe boolean,
  vibe_count bigint,
  circle_count bigint,
  report_count bigint,
  like_count bigint
) language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_app_admin();
  return query
  select
    p.id,
    u.email,
    p.display_name,
    p.age,
    p.university,
    p.course,
    p.bio,
    p.avatar_url,
    p.created_at,
    coalesce(ps.show_university, true),
    coalesce(ps.show_course, true),
    coalesce(ps.show_age, true),
    coalesce(ps.show_online_status, true),
    coalesce(ps.allow_dms, true),
    coalesce(ps.appear_in_cupid, true),
    coalesce(ps.appear_in_vibe, true),
    (select count(*) from vibes v where v.user_id = target_user),
    (select count(*) from circle_members cm where cm.user_id = target_user),
    (select count(*) from reports r where r.reported_user_id = target_user),
    (select count(*) from likes l where l.liker_id = target_user)
  from profiles p
  left join auth.users u on u.id = p.id
  left join privacy_settings ps on ps.user_id = p.id
  where p.id = target_user;
end;
$$;

-- 4. Admin Update Profile
create or replace function public.admin_update_profile(
  target_user uuid,
  p_display_name text,
  p_age int,
  p_university text,
  p_course text,
  p_bio text default null
)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.require_app_admin();
  update profiles
  set
    display_name = coalesce(trim(p_display_name), display_name),
    age = coalesce(p_age, age),
    university = coalesce(trim(p_university), university),
    course = coalesce(trim(p_course), course),
    bio = coalesce(trim(p_bio), bio)
  where id = target_user;

  insert into moderation_actions (admin_id, target_user_id, action, reason)
  values (auth.uid(), target_user, 'update_profile', 'Admin updated profile information');
end;
$$;

-- 5. Admin Unsuspend Profile
create or replace function public.admin_unsuspend_profile(target_user uuid, reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.require_app_admin();
  update privacy_settings
  set appear_in_cupid = true, appear_in_vibe = true, allow_dms = true
  where user_id = target_user;

  insert into moderation_actions (admin_id, target_user_id, action, reason)
  values (auth.uid(), target_user, 'unsuspend_profile_visibility', reason);
end;
$$;

-- 6. Admin Delete User Account & Cascade Data
create or replace function public.admin_delete_profile(target_user uuid, reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.require_app_admin();
  
  insert into moderation_actions (admin_id, target_user_id, action, reason)
  values (auth.uid(), target_user, 'delete_profile', reason);

  delete from profiles where id = target_user;
end;
$$;

-- 7. Admin Create Circle
create or replace function public.admin_create_circle(
  p_name text,
  p_icon text default '◌',
  p_description text default '',
  p_campus text default 'All Campuses'
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  new_circle_id uuid;
begin
  perform public.require_app_admin();

  insert into circles (name, icon, description, campus, created_by)
  values (trim(p_name), coalesce(nullif(trim(p_icon), ''), '◌'), trim(p_description), trim(p_campus), auth.uid())
  returning id into new_circle_id;

  insert into moderation_actions (admin_id, circle_id, action, reason)
  values (auth.uid(), new_circle_id, 'create_circle', 'Admin created circle: ' || p_name);

  return new_circle_id;
end;
$$;

-- 8. Admin Update Circle
create or replace function public.admin_update_circle(
  p_circle_id uuid,
  p_name text,
  p_icon text,
  p_description text,
  p_campus text
)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.require_app_admin();

  update circles
  set
    name = coalesce(trim(p_name), name),
    icon = coalesce(nullif(trim(p_icon), ''), icon),
    description = coalesce(trim(p_description), description),
    campus = coalesce(trim(p_campus), campus)
  where id = p_circle_id;

  insert into moderation_actions (admin_id, circle_id, action, reason)
  values (auth.uid(), p_circle_id, 'update_circle', 'Admin updated circle: ' || p_name);
end;
$$;

-- 9. Admin List Circle Posts
create or replace function public.admin_list_circle_posts(p_circle_id uuid, result_limit int default 50)
returns table (
  id uuid,
  circle_id uuid,
  user_id uuid,
  display_name text,
  body text,
  prompt text,
  media_url text,
  created_at timestamptz,
  reaction_count bigint
) language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_app_admin();
  return query
  select cp.id, cp.circle_id, cp.user_id, p.display_name, cp.body, cp.prompt, cp.media_url, cp.created_at,
    (select count(*) from circle_post_reactions cpr where cpr.post_id = cp.id)
  from circle_posts cp
  join profiles p on p.id = cp.user_id
  where cp.circle_id = p_circle_id
  order by cp.created_at desc
  limit least(greatest(result_limit, 1), 100);
end;
$$;

-- 10. Admin Delete Circle Post
create or replace function public.admin_delete_circle_post(p_post_id uuid, reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  target_user uuid;
  target_circle uuid;
begin
  perform public.require_app_admin();
  select user_id, circle_id into target_user, target_circle from circle_posts where id = p_post_id;
  delete from circle_posts where id = p_post_id;

  insert into moderation_actions (admin_id, target_user_id, circle_id, circle_post_id, action, reason)
  values (auth.uid(), target_user, target_circle, p_post_id, 'delete_circle_post', reason);
end;
$$;

-- 11. Admin List Moderation Audit Logs
create or replace function public.admin_list_moderation_actions(result_limit int default 100)
returns table (
  id uuid,
  admin_id uuid,
  admin_email text,
  target_user_id uuid,
  target_user_name text,
  vibe_id uuid,
  circle_id uuid,
  action text,
  reason text,
  created_at timestamptz
) language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_app_admin();
  return query
  select ma.id, ma.admin_id, u.email, ma.target_user_id, p.display_name, ma.vibe_id, ma.circle_id, ma.action, ma.reason, ma.created_at
  from moderation_actions ma
  left join auth.users u on u.id = ma.admin_id
  left join profiles p on p.id = ma.target_user_id
  order by ma.created_at desc
  limit least(greatest(result_limit, 1), 200);
end;
$$;

-- 12. Admin Team & Security Management
create or replace function public.admin_list_admins()
returns table (
  user_id uuid,
  email text,
  role text,
  active boolean,
  created_at timestamptz
) language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_app_admin();
  return query
  select aa.user_id, u.email, aa.role, aa.active, aa.created_at
  from app_admins aa
  join auth.users u on u.id = aa.user_id
  order by aa.created_at desc;
end;
$$;

create or replace function public.admin_add_admin(target_email text, p_role text default 'admin')
returns void language plpgsql security definer set search_path = public as $$
declare
  target_id uuid;
begin
  perform public.require_app_admin();
  select id into target_id from auth.users where email = lower(trim(target_email));
  if target_id is null then
    raise exception 'User with email % not found', target_email;
  end if;

  insert into app_admins (user_id, role, active)
  values (target_id, p_role, true)
  on conflict (user_id) do update set role = p_role, active = true;

  insert into moderation_actions (admin_id, target_user_id, action, reason)
  values (auth.uid(), target_id, 'grant_admin_role', 'Added/updated role: ' || p_role);
end;
$$;

create or replace function public.admin_toggle_admin(target_user uuid, is_active boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.require_app_admin();
  if target_user = auth.uid() and is_active = false then
    raise exception 'Cannot deactivate your own admin status';
  end if;

  update app_admins set active = is_active where user_id = target_user;

  insert into moderation_actions (admin_id, target_user_id, action, reason)
  values (auth.uid(), target_user, case when is_active then 'activate_admin' else 'deactivate_admin' end, 'Admin role status toggled');
end;
$$;

-- 13. Admin Broadcast Announcement Functions
create or replace function public.admin_create_broadcast(
  p_title text,
  p_message text,
  p_campus text default 'all'
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  new_id uuid;
begin
  perform public.require_app_admin();
  insert into campus_announcements (title, message, campus, created_by)
  values (trim(p_title), trim(p_message), trim(p_campus), auth.uid())
  returning id into new_id;

  insert into moderation_actions (admin_id, action, reason)
  values (auth.uid(), 'create_announcement', 'Broadcast: ' || p_title);

  return new_id;
end;
$$;

create or replace function public.admin_list_broadcasts()
returns table (
  id uuid,
  title text,
  message text,
  campus text,
  active boolean,
  created_at timestamptz
) language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_app_admin();
  return query
  select ca.id, ca.title, ca.message, ca.campus, ca.active, ca.created_at
  from campus_announcements ca
  order by ca.created_at desc
  limit 50;
end;
$$;
