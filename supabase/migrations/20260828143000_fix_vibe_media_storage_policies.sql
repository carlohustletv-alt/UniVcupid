drop policy if exists "vibe media is publicly readable" on storage.objects;
drop policy if exists "users upload own vibe media" on storage.objects;
drop policy if exists "users update own vibe media" on storage.objects;
drop policy if exists "users delete own vibe media" on storage.objects;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vibe-media', 'vibe-media', true, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = true,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "vibe media is publicly readable" on storage.objects
for select using (bucket_id = 'vibe-media');

create policy "users upload own vibe media" on storage.objects
for insert with check (
  bucket_id = 'vibe-media'
  and auth.role() = 'authenticated'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "users update own vibe media" on storage.objects
for update using (
  bucket_id = 'vibe-media'
  and auth.role() = 'authenticated'
  and auth.uid()::text = (storage.foldername(name))[1]
) with check (
  bucket_id = 'vibe-media'
  and auth.role() = 'authenticated'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "users delete own vibe media" on storage.objects
for delete using (
  bucket_id = 'vibe-media'
  and auth.role() = 'authenticated'
  and auth.uid()::text = (storage.foldername(name))[1]
);
