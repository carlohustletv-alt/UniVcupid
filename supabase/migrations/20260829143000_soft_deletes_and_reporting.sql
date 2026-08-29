-- =========================================================
-- UNIVCUPID SOFT DELETES & IN-APP REPORTING MIGRATION
-- Keeps user-deleted posts & messages in Supabase for admin audit & cleanup
-- =========================================================

-- 1. Add Soft Delete Columns
alter table public.vibes add column if not exists is_deleted boolean not null default false;
alter table public.vibes add column if not exists deleted_at timestamptz;

alter table public.messages add column if not exists is_deleted boolean not null default false;
alter table public.messages add column if not exists deleted_at timestamptz;

alter table public.circle_posts add column if not exists is_deleted boolean not null default false;
alter table public.circle_posts add column if not exists deleted_at timestamptz;

-- 2. Soft Delete RPC for Vibes
create or replace function public.soft_delete_vibe(target_vibe_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.vibes
  set is_deleted = true, deleted_at = now()
  where id = target_vibe_id and (user_id = auth.uid() or public.is_app_admin());
end;
$$;

-- 3. Soft Delete RPC for Messages
create or replace function public.soft_delete_message(target_msg_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.messages
  set is_deleted = true, deleted_at = now()
  where id = target_msg_id and (sender_id = auth.uid() or public.is_app_admin());
end;
$$;

-- 4. Soft Delete RPC for Circle Posts
create or replace function public.soft_delete_circle_post(target_post_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.circle_posts
  set is_deleted = true, deleted_at = now()
  where id = target_post_id and (user_id = auth.uid() or public.is_app_admin());
end;
$$;

-- 5. Submit Report RPC
create or replace function public.submit_report(
  p_reported_user_id uuid default null,
  p_vibe_id uuid default null,
  p_reason text default 'Inappropriate Content',
  p_details text default ''
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  new_report_id uuid;
begin
  insert into public.reports (reporter_id, reported_user_id, vibe_id, reason, details, status)
  values (auth.uid(), p_reported_user_id, p_vibe_id, trim(p_reason), trim(p_details), 'open')
  returning id into new_report_id;

  return new_report_id;
end;
$$;
