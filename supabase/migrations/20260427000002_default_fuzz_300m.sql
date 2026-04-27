-- Raise the default privacy offset from 200m to 300m.

alter table public.colonies alter column fuzz_radius_m set default 300;

create or replace function public.create_colony(
  p_name text,
  p_description text,
  p_lat double precision,
  p_lng double precision,
  p_fuzz_radius_m int default 300
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  insert into public.colonies (name, description, location, owner_id, fuzz_radius_m, fuzzed_location)
  values (
    p_name,
    p_description,
    ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
    auth.uid(),
    coalesce(p_fuzz_radius_m, 300),
    ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
  )
  returning id into new_id;

  insert into public.colony_memberships (colony_id, user_id, role, status, joined_via)
  values (new_id, auth.uid(), 'owner', 'active', 'created');

  return new_id;
end;
$$;

revoke all on function public.create_colony(text, text, double precision, double precision, int) from public;
grant execute on function public.create_colony(text, text, double precision, double precision, int) to authenticated;
