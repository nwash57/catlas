-- Colony core: profiles, colonies (with fuzzing), memberships.
--
-- Privacy invariant (CLAUDE.md hard constraint #1):
-- Precise colony coordinates in `colonies.location` must never reach a non-member.
-- Enforcement lives here, not in Angular. Two views split the read surface:
--   colonies_public  — fuzzed_location only; readable by anon + authenticated
--   colonies_full    — location included; readable only by active members (RLS)
-- If you add a column to `colonies`, decide which view it belongs in before merging.

-- Extensions ---------------------------------------------------------------

create extension if not exists postgis;
create extension if not exists pgcrypto;

-- Enums --------------------------------------------------------------------

do $$ begin
  create type public.colony_role as enum ('owner', 'caretaker', 'member');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.membership_status as enum ('pending', 'active');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.join_method as enum ('request', 'qr', 'created');
exception when duplicate_object then null; end $$;

-- profiles -----------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_path text,
  created_at timestamptz not null default now()
);

-- Auto-create a profile row whenever a new auth.users row appears.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, split_part(coalesce(new.email, ''), '@', 1))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- colonies -----------------------------------------------------------------

create table if not exists public.colonies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  description text,
  location geography(Point, 4326) not null,
  fuzzed_location geography(Point, 4326) not null,
  fuzz_radius_m int not null default 200 check (fuzz_radius_m between 50 and 5000),
  owner_id uuid not null references public.profiles(id) on delete restrict,
  cover_photo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists colonies_location_gix
  on public.colonies using gist (location);
create index if not exists colonies_fuzzed_location_gix
  on public.colonies using gist (fuzzed_location);
create index if not exists colonies_owner_idx
  on public.colonies (owner_id);

-- Fuzzed_location is a cached offset: uniform-random bearing, distance in
-- [0.5r, 1.0r]. Lower bound prevents coincidental near-matches to the real point.
-- Recompute only when location or radius changes so returning visitors see a
-- stable fuzzed pin.
create or replace function public.apply_colony_fuzz()
returns trigger
language plpgsql
as $$
declare
  azimuth double precision;
  distance double precision;
  recompute boolean := false;
begin
  if tg_op = 'INSERT' then
    recompute := true;
  elsif new.location is distinct from old.location
     or new.fuzz_radius_m is distinct from old.fuzz_radius_m then
    recompute := true;
  end if;

  if recompute then
    azimuth := random() * 2 * pi();
    distance := (0.5 + random() * 0.5) * new.fuzz_radius_m;
    new.fuzzed_location := ST_Project(new.location, distance, azimuth)::geography;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists colonies_fuzz_biu on public.colonies;
create trigger colonies_fuzz_biu
  before insert or update on public.colonies
  for each row execute function public.apply_colony_fuzz();

-- colony_memberships -------------------------------------------------------

create table if not exists public.colony_memberships (
  colony_id uuid not null references public.colonies(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.colony_role not null,
  status public.membership_status not null,
  joined_via public.join_method not null,
  created_at timestamptz not null default now(),
  primary key (colony_id, user_id)
);

create index if not exists colony_memberships_user_idx
  on public.colony_memberships (user_id);

-- Helper functions (SECURITY DEFINER so RLS policies on colonies/memberships
-- can call them without tripping recursive policy evaluation).

create or replace function public.is_active_member(colony uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.colony_memberships
    where colony_id = colony
      and user_id = auth.uid()
      and status = 'active'
  );
$$;

create or replace function public.is_colony_manager(colony uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.colony_memberships
    where colony_id = colony
      and user_id = auth.uid()
      and status = 'active'
      and role in ('owner', 'caretaker')
  );
$$;

-- Row-level security -------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.colonies enable row level security;
alter table public.colony_memberships enable row level security;

-- profiles: any authenticated user can read (display names shown to colony
-- members); only the profile owner can update.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (true);

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- colonies: no direct anon SELECT. Public surface is via `colonies_public` view.
-- Active members can read full rows via the base table (used by `colonies_full`).
drop policy if exists colonies_member_select on public.colonies;
create policy colonies_member_select on public.colonies
  for select to authenticated
  using (public.is_active_member(id));

-- Direct INSERT is allowed but `create_colony` RPC is the canonical path
-- because it also creates the owner membership row atomically.
drop policy if exists colonies_insert on public.colonies;
create policy colonies_insert on public.colonies
  for insert to authenticated
  with check (owner_id = auth.uid());

drop policy if exists colonies_update on public.colonies;
create policy colonies_update on public.colonies
  for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists colonies_delete on public.colonies;
create policy colonies_delete on public.colonies
  for delete to authenticated
  using (owner_id = auth.uid());

-- colony_memberships: readable by the member themselves, and by managers of
-- the colony (so they can see pending requests). No direct INSERT from clients —
-- use `create_colony` / `request_to_join` / `redeem_invite` RPCs (those come in
-- later migrations).
drop policy if exists memberships_self_select on public.colony_memberships;
create policy memberships_self_select on public.colony_memberships
  for select to authenticated
  using (user_id = auth.uid() or public.is_colony_manager(colony_id));

drop policy if exists memberships_self_update on public.colony_memberships;
create policy memberships_self_update on public.colony_memberships
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists memberships_manager_update on public.colony_memberships;
create policy memberships_manager_update on public.colony_memberships
  for update to authenticated
  using (public.is_colony_manager(colony_id))
  with check (public.is_colony_manager(colony_id));

drop policy if exists memberships_self_delete on public.colony_memberships;
create policy memberships_self_delete on public.colony_memberships
  for delete to authenticated
  using (user_id = auth.uid());

drop policy if exists memberships_manager_delete on public.colony_memberships;
create policy memberships_manager_delete on public.colony_memberships
  for delete to authenticated
  using (public.is_colony_manager(colony_id) and role <> 'owner');

-- Views --------------------------------------------------------------------

-- colonies_public: safe-for-anyone projection. Intentionally `security_invoker = off`
-- so the view runs with the owner's privileges and bypasses base-table RLS. This
-- is the privacy boundary — only columns listed here are exposed outside the
-- member set. Do not add `location` to this view. Ever.
drop view if exists public.colonies_public cascade;
create view public.colonies_public
  with (security_invoker = off) as
select
  id,
  name,
  description,
  fuzzed_location,
  fuzz_radius_m,
  cover_photo_path,
  created_at
from public.colonies;

grant select on public.colonies_public to anon, authenticated;

-- colonies_full: member-only full row. security_invoker = on so base-table RLS
-- (colonies_member_select) gates access.
drop view if exists public.colonies_full cascade;
create view public.colonies_full
  with (security_invoker = on) as
select
  id,
  name,
  description,
  location,
  fuzzed_location,
  fuzz_radius_m,
  owner_id,
  cover_photo_path,
  created_at,
  updated_at
from public.colonies;

grant select on public.colonies_full to authenticated;

-- RPCs ---------------------------------------------------------------------

-- Creates a colony and the owner membership row atomically. Clients should
-- prefer this over a direct INSERT so the two rows can never be out of sync
-- if one fails.
create or replace function public.create_colony(
  p_name text,
  p_description text,
  p_lat double precision,
  p_lng double precision,
  p_fuzz_radius_m int default 200
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
    coalesce(p_fuzz_radius_m, 200),
    ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography  -- placeholder; trigger overwrites
  )
  returning id into new_id;

  insert into public.colony_memberships (colony_id, user_id, role, status, joined_via)
  values (new_id, auth.uid(), 'owner', 'active', 'created');

  return new_id;
end;
$$;

revoke all on function public.create_colony(text, text, double precision, double precision, int) from public;
grant execute on function public.create_colony(text, text, double precision, double precision, int) to authenticated;
