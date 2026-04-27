# CLAUDE.md

Orientation for Claude (and human contributors). Read this first, then dive into `docs/`.

## What Catlas is

Catlas is a TNR-focused tool for mapping feral cat colonies — "bringing the community to community cats." Caretakers register colonies, record cats and TNR status, and recruit neighbors via request-to-join or printable QR flyers. A TNR education section and clinic directory back it up.

## Tech stack

- **Angular 21** (standalone components, signals-first) with **SSR** via `@angular/ssr` + Express (`src/server.ts`).
- **Tailwind CSS 4** (utility-first; no component library yet).
- **Supabase** — Postgres (PostGIS) with RLS, Auth (cookie sessions), Storage.
- **MapLibre GL JS** + OpenStreetMap tiles (provider TBD; proxied through the SSR server).
- **pnpm** (package manager, lockfile in repo).
- **Vitest** for unit tests; **Playwright** for e2e.

## Hard constraints

Do not compromise these without an explicit conversation:

1. **Never expose precise colony coordinates to non-members.** Ring-style privacy. The public map renders a fuzzed area, not a pin. Enforcement is at the database via RLS + views (`colonies_public` vs `colonies_full`), not in Angular. See [docs/architecture.md](./docs/architecture.md#privacy-enforcement-critical) and [docs/data-model.md](./docs/data-model.md#row-level-security).
2. **RLS is the authoritative authorization layer.** Angular guards exist only for UX. Never duplicate permission logic in the app; it will drift from the DB and leak.
3. **Strip EXIF (including GPS) from every uploaded photo.** Photos are a second coordinate-leak vector. Uploads go through an SSR route that strips metadata before writing to Storage.
4. **The service-role Supabase key never touches the browser.** Server process only.
5. **SSR-safe code.** No raw `window`/`document` access outside platform-browser guards; the SSR render must not crash.

## Where to find things

| Concern | Doc |
| --- | --- |
| Why we're building this, personas, non-goals | [docs/vision.md](./docs/vision.md) |
| MVP scope, user stories, acceptance criteria, parking lot | [docs/features.md](./docs/features.md) |
| System design, Angular routes, map stack, auth, QR flow | [docs/architecture.md](./docs/architecture.md) |
| Tables, RLS policies, fuzzing strategy, storage | [docs/data-model.md](./docs/data-model.md) |

## Common commands

```bash
pnpm start                    # ng serve on http://localhost:4201
pnpm build                    # production build into dist/
pnpm test                     # Vitest
pnpm run serve:ssr:catlas     # run the built SSR server
```

## Conventions

- **Standalone components**, signals over RxJS where feasible (Angular 21 default).
- **Feature folders** under `src/app/` (`map/`, `colonies/`, `cats/`, `membership/`, `invites/`, `clinics/`, `learn/`, `auth/`, `dashboard/`); shared under `src/app/shared/`.
- **Tailwind utility-first.** No bespoke CSS files unless there's a reason; component `*.css` should usually stay empty.
- **Two Supabase clients** — `supabaseBrowser` (anon key, client code) and `supabaseServer` (per-request, SSR). The service-role key is only used in specific SSR routes (invite signing, EXIF-stripped uploads, admin seeds).
- **Content pages** under `src/content/` as markdown for MVP. No CMS yet.
- **Migrations** live under `supabase/migrations/` (to be added). Every migration that touches a user-data table must set up RLS in the same file.

## Scope posture

MVP is the four pillars from [docs/features.md](./docs/features.md): map + pins + auth; cat profiles; membership (request + QR); TNR education + clinics. Anything else is the parking lot until those ship. When a new idea comes up, the default answer is "add it to the parking lot."

## Open questions

The docs each end with an "Open questions" section. Treat these as live — revisit them before making decisions in adjacent areas.
