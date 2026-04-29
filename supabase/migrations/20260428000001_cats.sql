-- Cats: per-colony cat profiles with public/private split.
--
-- Privacy model:
--   cats_public  — public-safe columns, only rows where parent colony is_public = true
--   cats_full    — all columns, gated by colony membership via base-table RLS
-- Non-members never see notes, health_concerns, sterilization, sex,
-- temperament, scheduled_for, or any cat from a private colony.

-- Enums --------------------------------------------------------------------

do $$ begin
  create type public.cat_sex as enum ('unknown', 'male', 'female');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.cat_age as enum ('unknown', 'kitten', 'juvenile', 'adult', 'senior');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.cat_temperament as enum ('unknown', 'feral', 'socializable', 'friendly');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.cat_sterilization as enum ('unknown', 'intact', 'sterilized');
exception when duplicate_object then null; end $$;

-- cats ---------------------------------------------------------------------

create table if not exists public.cats (
  id uuid primary key default gen_random_uuid(),
  colony_id uuid not null references public.colonies(id) on delete cascade,
  name text,
  description text,
  photo_path text,
  coat text,
  approx_age public.cat_age not null default 'unknown',
  sex public.cat_sex not null default 'unknown',
  temperament public.cat_temperament not null default 'unknown',
  sterilization public.cat_sterilization not null default 'unknown',
  ear_tipped boolean not null default false,
  scheduled_for timestamptz,
  notes text,
  health_concerns text,
  deceased_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cats_colony_idx on public.cats (colony_id);

create or replace function public.touch_cat_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists cats_touch_updated_at on public.cats;
create trigger cats_touch_updated_at
  before update on public.cats
  for each row execute function public.touch_cat_updated_at();

-- RLS ----------------------------------------------------------------------

alter table public.cats enable row level security;

drop policy if exists cats_member_select on public.cats;
create policy cats_member_select on public.cats
  for select to authenticated
  using (public.is_active_member(colony_id));

drop policy if exists cats_manager_insert on public.cats;
create policy cats_manager_insert on public.cats
  for insert to authenticated
  with check (public.is_colony_manager(colony_id) and created_by = auth.uid());

drop policy if exists cats_manager_update on public.cats;
create policy cats_manager_update on public.cats
  for update to authenticated
  using (public.is_colony_manager(colony_id))
  with check (public.is_colony_manager(colony_id));

drop policy if exists cats_manager_delete on public.cats;
create policy cats_manager_delete on public.cats
  for delete to authenticated
  using (public.is_colony_manager(colony_id));

-- Views --------------------------------------------------------------------

-- cats_public: anon + authenticated. Only rows from colonies with is_public = true.
-- security_invoker = off so the view bypasses base-table RLS; the privacy boundary
-- is this view's column list and WHERE clause. Do not add notes, health_concerns,
-- sterilization, sex, temperament, or scheduled_for to this view. Ever.
drop view if exists public.cats_public cascade;
create view public.cats_public
  with (security_invoker = off) as
select
  c.id,
  c.colony_id,
  c.name,
  c.description,
  c.photo_path,
  c.coat,
  c.approx_age,
  c.ear_tipped,
  c.deceased_at,
  c.created_at
from public.cats c
join public.colonies col on col.id = c.colony_id
where col.is_public = true;

grant select on public.cats_public to anon, authenticated;

-- cats_full: member-only full row. security_invoker = on so base-table RLS gates it.
drop view if exists public.cats_full cascade;
create view public.cats_full
  with (security_invoker = on) as
select
  id,
  colony_id,
  name,
  description,
  photo_path,
  coat,
  approx_age,
  sex,
  temperament,
  sterilization,
  ear_tipped,
  scheduled_for,
  notes,
  health_concerns,
  deceased_at,
  created_by,
  created_at,
  updated_at
from public.cats;

grant select on public.cats_full to authenticated;

-- Refresh colonies_public with cat_count and eartipped_count ---------------
-- These aggregate counts are exposed publicly even for private colonies (the
-- count itself is a community-trust signal, not sensitive data). The cat
-- *rows* remain hidden via cats_public's WHERE col.is_public = true.

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
  (select count(*)::int from public.cats cc
   where cc.colony_id = c.id and cc.deceased_at is null) as cat_count,
  (select count(*)::int from public.cats cc
   where cc.colony_id = c.id and cc.deceased_at is null and cc.ear_tipped) as eartipped_count,
  c.created_at
from public.colonies c;

grant select on public.colonies_public to anon, authenticated;
