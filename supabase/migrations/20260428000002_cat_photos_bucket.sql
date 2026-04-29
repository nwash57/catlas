-- Storage: cat-photos bucket.
--
-- Private bucket. Browser never reads this bucket directly — the SSR server
-- mediates both upload (via service role, after EXIF strip) and read (via
-- short-lived signed URLs after a per-request authorization check). No
-- bespoke storage.objects RLS policies are needed because:
--   * the service role bypasses RLS (used for upload + signed URL issuance)
--   * the anon/authenticated roles never SELECT from storage.objects directly
-- If a future client ever calls storage.from('cat-photos') from the browser,
-- add deny-by-default policies first.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'cat-photos',
  'cat-photos',
  false,
  8 * 1024 * 1024,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
