# Catlas — Technical Architecture

How the pieces fit together. Paired with [data-model.md](./data-model.md), which owns the schema and RLS.

## System diagram

```
        ┌───────────────────────────┐
        │          Browser          │
        │  Angular (hydrated SPA)   │
        └──────────┬────────────────┘
                   │  HTTPS
                   ▼
        ┌───────────────────────────┐         ┌───────────────────────┐
        │   Angular SSR (Express)   │────────▶│   OSM tile provider   │
        │   - renders initial HTML  │         │  (MapTiler / Stadia / │
        │   - proxies Supabase auth │         │   self-hosted)        │
        │   - signs QR invite tokens│         └───────────────────────┘
        │   - strips EXIF on upload │
        └──────────┬────────────────┘
                   │
                   ▼
        ┌───────────────────────────┐
        │         Supabase          │
        │  Postgres (PostGIS) + RLS │
        │  Auth (cookies)           │
        │  Storage (photos)         │
        └───────────────────────────┘
```

The browser talks to Supabase directly for most reads/writes (RLS does the gating). The SSR server handles: initial render, session cookie handoff, operations that need a secret (token signing, EXIF stripping), and anything the user-agent's network tab shouldn't show.

## Angular app structure

**Runtime.** Angular 21 standalone components, signals-first, SSR via `@angular/ssr` + Express (already scaffolded in `src/server.ts`).

**Route map (initial).**

| Path | Render | Notes |
| --- | --- | --- |
| `/` | SSR | Landing; explains Catlas, CTA to map and to sign up. |
| `/map` | SSR shell, client map | Fuzzed public map. Map itself is client-only (no SSR for the map canvas). |
| `/colonies/:id` | SSR if public data, client-hydrated for member content | Public card by default; member view if the user is a member. |
| `/cats/:id` | Client-only (member) | 404 for non-members. |
| `/join/:token` | SSR | Verifies token, handles unauth users by routing to sign-up then auto-joining. |
| `/resources`, `/clinics` | SSR | Directory; SEO-indexable. |
| `/learn/*` | SSR | Markdown content pages; SEO-indexable. |
| `/auth/*` | SSR | Sign-in, sign-up, password reset. |
| `/dashboard` | Client (auth-gated) | Colony management, pending requests, invite tokens, flyer generation. |

**Feature folders** under `src/app/`: `map/`, `colonies/`, `cats/`, `membership/`, `invites/`, `clinics/`, `learn/`, `auth/`, `dashboard/`. Shared building blocks under `src/app/shared/` (ui, forms, supabase client).

## Supabase integration

**Two clients.**

- `supabaseBrowser` — anon key; used in client code; session persisted via cookies (Supabase SSR helper) so SSR and browser share auth state.
- `supabaseServer` — created per-request in the Express SSR server, reads the cookie, sets the auth context. Used inside Angular `APP_INITIALIZER`-style providers and server routes.

The service-role key lives **only** in the SSR server process, only used by specific server routes (EXIF stripping, invite signing, admin seeds). Never shipped to the browser, never logged.

**Auth.** Supabase Auth. Email+password for MVP; OAuth providers are an open question (see [features.md](./features.md#open-questions)). Session cookies are set by Supabase's SSR helper so hydration inherits the signed-in state — no flash of signed-out UI.

## Map stack

**Library recommendation: MapLibre GL JS.** Vector tiles, smooth pan/zoom, clustering via `maplibre-gl`'s built-in cluster source. Leaflet is simpler but raster-only and ages less gracefully. Not a huge commitment either way — both are permissive licenses and similar APIs.

**Tile provider: open question.** Three realistic paths:

1. **MapTiler / Stadia Maps free tier.** Simplest; works immediately. Rate-limited; requires attribution.
2. **OpenFreeMap / Protomaps tiles.** Genuinely free and ToS-friendly, but self-hosting the pbf bundle or proxying costs effort.
3. **Self-hosted tile server (Martin / tileserver-gl).** Most control, highest ops burden. Not for MVP.

Default for MVP: start on MapTiler free tier behind the SSR server as a tile proxy so we can swap providers without a client deploy. Write the abstraction now, even if it just passes through.

**Clustering.** Use the tile provider's clustering if available; otherwise do it client-side on `fuzzed_location`. At city zoom, a single aggregated dot is fine; at street zoom, show the area circle.

## Privacy enforcement (critical)

This is the load-bearing part of the architecture. Every other feature depends on it.

**The contract.** Non-members never receive precise coordinates. Enforced at the database via RLS + views (see [data-model.md](./data-model.md#row-level-security)). The Angular code cannot leak what it cannot request.

**What the public map actually loads.**

1. Client queries the `colonies_public` view with a bounding-box filter.
2. Postgres returns rows with `fuzzed_location` only — `location` is not in the view.
3. Client renders a soft-edged circle of radius `fuzz_radius_m` at `fuzzed_location`, not a pin.

**What a member loads for their colony page.**

1. Client queries the `colonies_full` view (or base table) for that id.
2. RLS checks `colony_memberships` for `(auth.uid(), colony_id, status='active')`.
3. On pass, the row comes back with `location`. The UI switches from circle to pin.

**Audit rules.**

- No Angular service may hold precise coordinates for a colony the user is not a member of. If a feature seems to require it, that feature is wrong — fix it at the data layer.
- PR review checklist must include "did we send `location` to the browser where we shouldn't?"
- EXIF is stripped server-side on photo upload (see Storage below); a photo is effectively a second leak vector for coordinates.

## Auth & sessions

- Supabase Auth cookies readable on both sides via `@supabase/ssr`.
- Angular route guards exist for UX (avoid rendering auth-gated screens while unauthenticated), but **authorization** is the DB's job. Don't re-derive who-can-see-what in Angular; it will drift.
- Sign-out invalidates the Supabase session and clears the cookie.

## QR / invite flow

1. An owner or caretaker generates an invite: POST to an SSR route `/api/invites` with `{colonyId, role, expiresAt?, maxUses?}`.
2. Server HMAC-signs `{inviteId, colonyId, role}` with a server-only secret and stores the token row (see `colony_invites` in data-model).
3. Client gets back the token; renders a QR encoding `https://catlas.app/join/:token`.
4. On scan (or click), `/join/:token` (SSR):
   - If unauthenticated, stores the token in a short-lived cookie and redirects to sign-up; after sign-up, redirects back to `/join/:token`.
   - If authenticated, calls the `redeem_invite(token)` Postgres function.
   - Renders a success page and links to the colony.
5. The flyer print view (`/dashboard/colonies/:id/flyer`) renders the same QR plus a short "What is TNR?" blurb, styled for 8.5×11" and A4 via CSS `@media print`.

## Content pages (TNR / clinics)

**Recommendation for MVP: markdown-in-repo.** Place pages under `src/content/learn/*.md`, parse at build time (Angular loader or simple Vite plugin), render via a single `<content-page>` component. SSR-rendered, SEO-indexable, zero DB round-trip. Edits require a redeploy — acceptable at this stage.

If we later need non-developer editing, add a `content_pages` table and a lightweight admin UI; the public component signature can stay the same.

Clinics are data, not content — they live in Postgres (see [data-model.md](./data-model.md#clinics)) and render via the same SSR page pattern.

## Storage

- `cat-photos` — private bucket; members read via signed URLs issued by an SSR route that checks membership.
- `colony-covers` — public-read; OK to link directly from `<img src>`.
- **EXIF stripping.** All photo uploads go through an SSR route, not direct-to-Supabase. The route pipes through `sharp` (or similar) with `.withMetadata({})` to drop EXIF, then uploads to Storage with the service-role client. GPS leakage through photos is the primary failure mode the privacy model cares about beyond the coordinates themselves.
- File size cap (e.g. 8 MB) and content-type allowlist (`image/jpeg`, `image/png`, `image/webp`).

## Testing posture

- **Vitest** (already configured) for unit tests: pure utilities, signals-based components, fuzzing math, invite token codec.
- **Playwright** (available as MCP) for happy-path e2e: sign-up → create colony → generate QR → second user scans → lands in colony.
- **RLS tests.** Non-negotiable. Use `supabase-js` with the anon key and with a logged-in-as-non-member to assert that `colonies_full`, `cats`, `cat_events`, and invite tokens are invisible. These tests are the privacy contract; if they break, nothing ships.

## Environments & config

- `.env` for SSR: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `INVITE_SIGNING_SECRET`, `TILE_PROVIDER_KEY`.
- Browser gets only the URL and anon key via Angular's standard env injection.
- Local dev: `supabase start` for a local stack; seed script for a few test colonies and clinics.

## Open questions

- **Tile provider** — finalize MapTiler vs. Protomaps once we know the launch region's scale.
- **PWA / offline.** Do we need offline map tiles and caretaker notes for field use? Nice but not MVP.
- **Map SSR.** The map page's shell SSRs for SEO; the canvas is client-only. Revisit if Googlebot indexing matters for colony discovery pages.
- **Edge functions vs. Angular SSR routes.** Prefer Angular SSR routes for MVP (one process, one deploy). Move hot paths (invite redemption, photo upload) to Supabase Edge Functions later if needed.
- **Rate limiting.** Especially on invite redemption and join requests. Probably a `pg_cron`-cleaned rate table, or Cloudflare in front.
