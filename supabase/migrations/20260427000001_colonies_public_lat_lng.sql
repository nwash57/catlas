-- Replace fuzzed_location geography column in colonies_public with plain lat/lng
-- numbers so PostgREST returns them without WKB encoding.

drop view if exists public.colonies_public;
create view public.colonies_public
  with (security_invoker = off) as
select
  id,
  name,
  description,
  ST_Y(fuzzed_location::geometry) as lat,
  ST_X(fuzzed_location::geometry) as lng,
  fuzz_radius_m,
  cover_photo_path,
  created_at
from public.colonies;

grant select on public.colonies_public to anon, authenticated;
