-- Add is_public flag, rebuild views, add update_colony and request_to_join RPCs.

-- is_public column ---------------------------------------------------------

alter table public.colonies
  add column if not exists is_public boolean not null default false;

-- colonies_public (rebuilt to add is_public + active member_count) ---------

drop view if exists public.colonies_public;
create view public.colonies_public
  with (security_invoker = off) as
select
  c.id,
  c.name,
  c.description,
  ST_Y(c.fuzzed_location::geometry) as lat,
  ST_X(c.fuzzed_location::geometry) as lng,
  c.fuzz_radius_m,
  c.cover_photo_path,
  c.is_public,
  (select count(*)::int from public.colony_memberships cm
   where cm.colony_id = c.id and cm.status = 'active') as member_count,
  c.created_at
from public.colonies c;

grant select on public.colonies_public to anon, authenticated;

-- colonies_full (rebuilt: extract lat/lng as numbers, add is_public) --------

drop view if exists public.colonies_full;
create view public.colonies_full
  with (security_invoker = on) as
select
  id,
  name,
  description,
  ST_Y(location::geometry)         as lat,
  ST_X(location::geometry)         as lng,
  ST_Y(fuzzed_location::geometry)  as fuzzed_lat,
  ST_X(fuzzed_location::geometry)  as fuzzed_lng,
  fuzz_radius_m,
  owner_id,
  cover_photo_path,
  is_public,
  created_at,
  updated_at
from public.colonies;

grant select on public.colonies_full to authenticated;

-- update_colony RPC (owner-only) -------------------------------------------

create or replace function public.update_colony(
  p_colony_id  uuid,
  p_name       text    default null,
  p_description text   default null,
  p_is_public  boolean default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  update public.colonies set
    name        = coalesce(p_name, name),
    description = coalesce(p_description, description),
    is_public   = coalesce(p_is_public, is_public)
  where id = p_colony_id
    and owner_id = auth.uid();

  if not found then
    raise exception 'colony not found or permission denied' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.update_colony(uuid, text, text, boolean) from public;
grant execute on function public.update_colony(uuid, text, text, boolean) to authenticated;

-- request_to_join RPC -------------------------------------------------------

create or replace function public.request_to_join(p_colony_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  insert into public.colony_memberships (colony_id, user_id, role, status, joined_via)
  values (p_colony_id, auth.uid(), 'member', 'pending', 'request')
  on conflict (colony_id, user_id) do nothing;
end;
$$;

revoke all on function public.request_to_join(uuid) from public;
grant execute on function public.request_to_join(uuid) to authenticated;
