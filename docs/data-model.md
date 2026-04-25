# Catlas — Data Model & RLS

The schema is where the privacy promise is kept or broken. Read this before writing any migration.

**Rule of thumb:** if a policy decision exists in both the database and the app, the database is authoritative. Do not duplicate checks in Angular.

## Entity overview (ASCII ERD)

```
auth.users ──1──1── profiles
                       │
                       │ owns / creates
                       ▼
                    colonies ──1──N── cats ──1──N── cat_events
                       │                │
                       │                └── photos (Supabase Storage)
                       │
                       ├──1──N── colony_memberships ── N──1── profiles
                       │
                       └──1──N── colony_invites (redeemed → memberships)

                    clinics          (independent, public-read)
                    content_pages    (optional; markdown-in-repo is the default)
```

## Tables

### `profiles`
One row per `auth.users`, created via trigger on sign-up.

| column | type | notes |
| --- | --- | --- |
| `id` | `uuid` PK | references `auth.users(id)` |
| `display_name` | `text` | nullable; default to email local-part |
| `avatar_path` | `text` | Supabase Storage path |
| `created_at` | `timestamptz` | default `now()` |

### `colonies`
The sensitive table. Precise coordinates live here; only members may read them.

| column | type | notes |
| --- | --- | --- |
| `id` | `uuid` PK | default `gen_random_uuid()` |
| `name` | `text` | 1..80 chars, not null |
| `description` | `text` | nullable |
| `location` | `geography(Point, 4326)` | **precise**, never exposed to non-members |
| `fuzzed_location` | `geography(Point, 4326)` | populated by trigger; safe for public view |
| `fuzz_radius_m` | `int` | default 200; per-colony so sensitive colonies can increase it |
| `owner_id` | `uuid` | references `profiles(id)` |
| `cover_photo_path` | `text` | nullable |
| `created_at` | `timestamptz` | default `now()` |
| `updated_at` | `timestamptz` | bumped via trigger |

Indexes: GIST on `location` and `fuzzed_location`.

### `cats`
Member-only. Non-members must never receive any row.

| column | type | notes |
| --- | --- | --- |
| `id` | `uuid` PK | |
| `colony_id` | `uuid` | references `colonies(id)` on delete cascade |
| `name` | `text` | nullable (`"Unnamed #3"` handled in UI) |
| `photo_path` | `text` | Supabase Storage; EXIF-stripped |
| `tnr_status` | `tnr_status` enum | `unknown` \| `intact` \| `scheduled` \| `ear_tipped` \| `neutered` |
| `description` | `text` | |
| `deceased_at` | `timestamptz` | nullable |
| `created_by` | `uuid` | references `profiles(id)` |
| `created_at` / `updated_at` | `timestamptz` | |

### `cat_events`
Timeline entries for a cat.

| column | type | notes |
| --- | --- | --- |
| `id` | `uuid` PK | |
| `cat_id` | `uuid` | on delete cascade |
| `kind` | `cat_event_kind` enum | `trapped` \| `vetted` \| `returned` \| `sighted` \| `deceased` |
| `occurred_at` | `timestamptz` | |
| `notes` | `text` | |
| `created_by` | `uuid` | references `profiles(id)` |
| `created_at` | `timestamptz` | |

### `colony_memberships`
The authorization table — every RLS policy on `cats`, `cat_events`, and precise-colony reads pivots on this.

| column | type | notes |
| --- | --- | --- |
| `colony_id` | `uuid` | part of PK |
| `user_id` | `uuid` | part of PK; references `profiles(id)` |
| `role` | `colony_role` enum | `owner` \| `caretaker` \| `member` |
| `status` | `membership_status` enum | `pending` \| `active` |
| `joined_via` | `join_method` enum | `request` \| `qr` \| `created` |
| `created_at` | `timestamptz` | |

Primary key: `(colony_id, user_id)`.

### `colony_invites`
Signed tokens backing the QR flow.

| column | type | notes |
| --- | --- | --- |
| `id` | `uuid` PK | |
| `colony_id` | `uuid` | |
| `token` | `text` | unique; HMAC-signed server-side. Never log this. |
| `role` | `colony_role` | role to grant on redemption |
| `expires_at` | `timestamptz` | nullable |
| `max_uses` | `int` | nullable (null = unlimited) |
| `uses` | `int` | default 0 |
| `created_by` | `uuid` | |
| `created_at` | `timestamptz` | |

Redemption goes through a `SECURITY DEFINER` function `redeem_invite(token)` that: validates expiry/uses, inserts a `colony_memberships` row, increments `uses`, returns the colony id. No direct `INSERT` on `colony_memberships` from the client.

### `clinics`
Public directory — no privacy constraint.

| column | type | notes |
| --- | --- | --- |
| `id` | `uuid` PK | |
| `name` | `text` | |
| `location` | `geography(Point, 4326)` | precise — clinics are public businesses |
| `address` | `text` | |
| `services` | `text[]` | e.g. `{'tnr', 'spay_neuter', 'trap_loan'}` |
| `cost_notes` | `text` | |
| `hours` | `jsonb` | flexible; TBD structure |
| `url` | `text` | |
| `phone` | `text` | |
| `verified` | `bool` | default false |
| `created_at` / `updated_at` | `timestamptz` | |

### `content_pages` (optional)
Only create this table if/when we need CMS-style editing without a redeploy. For MVP, prefer markdown files under `src/content/`.

## PostGIS usage

- Use `geography(Point, 4326)` (not `geometry`) so distance/bbox queries are in meters and handle the globe correctly.
- GIST index every spatial column that will be queried.
- Map viewport queries use `ST_Intersects(fuzzed_location, ST_MakeEnvelope(...))` against the public view.
- Distance-sorted queries (nearest clinics) use `<->` with a GIST index.

## Fuzzing strategy

Preferred approach for MVP: **store a precomputed random offset**.

- On `INSERT` or `UPDATE` of `colonies.location`, a trigger sets `fuzzed_location` to `location` shifted by a uniform-random bearing and a uniform-random distance in `[0.5 * fuzz_radius_m, 1.0 * fuzz_radius_m]`.
- Lower bound avoids coincidental near-matches to the real point.
- Offset is cached in the column, not recomputed per query — stable for returning visitors, and cheap to read.
- Document in migration comments that `fuzzed_location` is not a security boundary by itself; the RLS policies + views below are.

Considered and rejected for MVP: H3 hex aggregation. Cleaner in theory, but adds a dependency and a UX question (how do we draw hex boundaries?) that we don't need to answer yet.

## Row-level security

Enable RLS on every user-data table. Default deny, then opt in.

### `colonies` — split into two reads

Easiest to implement as **two views** over the table, each with its own grant/policy:

- **`colonies_public`** (view): exposes `id`, `name`, `description`, `fuzzed_location`, `fuzz_radius_m`, `cover_photo_path`, `created_at`. Grant `SELECT` to `anon` and `authenticated`.
- **`colonies_full`** (view, or the base table with RLS): exposes `location` and all columns. Policy: `SELECT` allowed iff `exists (select 1 from colony_memberships m where m.colony_id = colonies.id and m.user_id = auth.uid() and m.status = 'active')`.

Write policies on the base table:
- `INSERT`: allowed to `authenticated`; `owner_id` must equal `auth.uid()`. The same transaction should insert a `colony_memberships` row with role `owner`, status `active`, `joined_via = 'created'`. Encapsulate as a `create_colony(...)` RPC to avoid racing clients.
- `UPDATE`: allowed iff `auth.uid() = owner_id`.
- `DELETE`: allowed iff `auth.uid() = owner_id`. Cascades to `cats`, `cat_events`, `colony_memberships`, `colony_invites`.

### `cats` — members only

- `SELECT`: `auth.uid()` has an active membership in `cats.colony_id`.
- `INSERT` / `UPDATE`: member with role `owner` or `caretaker`.
- `DELETE`: `owner` or `caretaker`.

### `cat_events` — same as `cats`

### `colony_memberships`

- `SELECT`: the row's `user_id = auth.uid()`, OR `auth.uid()` is `owner`/`caretaker` on the same colony.
- `INSERT`: **deny direct inserts from clients.** All inserts go through `redeem_invite` (QR/pending→active) or `request_to_join` (inserts with `status = 'pending'`) RPCs.
- `UPDATE`: owner/caretakers can set `status = 'active'` (approve request) or demote roles; users can set their own `status` for leaving.
- `DELETE`: self, or owner removing a non-owner.

### `colony_invites`

- `SELECT`: owner/caretakers of the colony.
- `INSERT` / `UPDATE` / `DELETE`: owner/caretakers.
- Redemption is **not** a `SELECT` from the client — it goes through `redeem_invite(token)` which runs as `SECURITY DEFINER` and does its own token validation.

### `clinics`

- `SELECT`: grant to `anon` and `authenticated`.
- Mutations: restricted to an `admin` role (claim on JWT) for MVP; community submissions post-MVP.

### `profiles`

- `SELECT`: grant to `authenticated` (display names are visible to colony members; trim to minimum as needed).
- `UPDATE`: self only.

## Storage

- Bucket `cat-photos` (private). Access via signed URLs; members get URLs, non-members get 403.
- Bucket `colony-covers` (public-read).
- Upload path: Edge Function or Angular server route that receives the file, strips EXIF (including GPS), and uploads to Storage with the owning colony/cat id in the path so RLS-style policies on storage can key off it.

## What never leaves the server for non-members

A short list to keep honest:

- `colonies.location` (precise).
- Any row in `cats`, `cat_events`, or `colony_memberships` for a colony the caller is not in.
- Invite tokens.
- Signed photo URLs for member-only buckets.

If something on this list shows up in a non-member response, that's a bug of the highest priority.

## Open questions

- **Admin / moderation roles.** JWT claim, separate table, or Supabase's built-in role system? Probably JWT claim set via a server-side admin console.
- **Soft delete vs. hard delete.** Currently all cascading hard deletes. Do we want a `deleted_at` column on `colonies` for recoverability? Leaning no — privacy expectations favor real deletion.
- **Audit log.** Not in MVP schema; add `colony_audit` table later if needed.
- **Geocoding.** Do we store a reverse-geocoded city/neighborhood for public display, or derive it client-side? Server-side is safer (consistent, testable).
- **Multi-tenant regions.** Is there ever a region-level admin scope (e.g. "Portland TNR Alliance" manages 40 colonies)? If yes, this schema needs an `organizations` table down the road.
