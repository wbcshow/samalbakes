-- Apply after approval. Product images are public; uploads are admin-only.
begin;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-photos', 'product-photos', true, 5242880,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists product_photos_admin_insert on storage.objects;
create policy product_photos_admin_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'product-photos'
  and public.is_admin()
  and (storage.foldername(name))[1] = auth.uid()::text
);
commit;
