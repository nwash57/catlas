# Supabase migrations

SQL migrations for the Catlas Postgres schema. Apply with the Supabase CLI
(`supabase db push` against a local stack, or via the dashboard SQL editor
for a hosted project).

## Conventions

- **Filename**: `YYYYMMDDHHMMSS_short_description.sql` (UTC timestamps). Keep
  the description snake_case and descriptive enough to grep for.
- **RLS in the same file.** Every migration that creates or alters a table
  holding user data MUST set up row-level security in the same migration.
  This is a hard constraint — see `CLAUDE.md`. A schema change without RLS
  is a privacy leak waiting to ship.
- **One concern per file.** Prefer small, focused migrations over giant
  multi-table changes. Roll-forward only; do not amend a merged migration.
- **Idempotent where possible.** Use `create ... if not exists`, `drop ...
  if exists`, `alter ... add column if not exists` so reruns are safe.

## What lives here next

Nothing yet — auth uses Supabase's built-in `auth.users` table. The first
real migration lands with pillar 1 (map + colonies), which adds:

- `colonies` (PostGIS `geography(Point)` for precise `location`, plus
  `fuzzed_location` + `fuzz_radius_m`)
- `colonies_public` and `colonies_full` views
- `colony_memberships` join table with role enum
- RLS policies keyed off `auth.uid()` and `colony_memberships`
