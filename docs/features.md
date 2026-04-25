# Catlas — Features & MVP Scope

This doc defines what ships in v1. Anything not listed here is in the parking lot at the bottom. When in doubt, cut.

See [vision.md](./vision.md) for the why, [architecture.md](./architecture.md) for the how, and [data-model.md](./data-model.md) for the schema.

## MVP: the four pillars

### 1. Map + colony pins + auth

The base loop: sign up, place a colony, see what's near you.

**User story.** As a **caretaker**, I want to place my colony on the map and sign in so that I can start recording cats and invite neighbors to join.

**Scope.**
- Email/password auth via Supabase Auth (OAuth is an open question — see below).
- Anonymous visitors can pan/zoom the map and see **fuzzed** colony areas — not exact pins. See [architecture.md](./architecture.md#privacy-enforcement-critical).
- Signed-in users can create a colony: name, short description, drop a pin (exact coordinates stored server-side only), optional photo.
- Map shows clustered fuzzed markers at low zoom, area highlights at high zoom.
- Clicking a public marker shows the colony name, description, and a "Request to join" or "Sign in to join" CTA. No cats, no exact location, no member list.

**Acceptance criteria.**
- Anonymous user loads `/map` and sees fuzzed markers within the viewport.
- Network/devtools inspection reveals no precise `lat`/`lng` for colonies the user is not a member of.
- Signed-in user can create a colony and immediately see it on their own map in precise form.
- Creating a colony requires a placed location, a name (1–80 chars), and nothing else.
- Sign-up / sign-in / sign-out all work across SSR reload (cookie-based session).

### 2. Cat profiles within a colony

The data caretakers actually want to keep.

**User story.** As a **caretaker**, I want to add a profile for each cat in my colony so that I can track who has been TNR'd, who is new, and who I've lost.

**Scope.**
- A colony member can add/edit cats: name (or "Unnamed #3"), optional photo, description, TNR status (`unknown` / `intact` / `scheduled` / `ear_tipped` / `neutered`), `deceased_at` (nullable).
- A cat has a simple timeline of events: `trapped`, `vetted`, `returned`, `sighted`, `deceased`. Each event has a date and free-text note.
- Photos upload to Supabase Storage; **EXIF GPS is stripped on upload** (privacy).
- Only colony members can read cat data. Non-members never see cat lists, photos, or names.

**Acceptance criteria.**
- A colony member can create a cat, add a photo, and see it in the colony's cat list.
- TNR status is a constrained enum; the UI surfaces ear-tip status clearly (it's the primary TNR signal).
- A non-member navigating directly to `/cats/:id` gets a 404 or "not authorized" page — not a leak.
- Uploading a photo with GPS EXIF results in a stored photo with that metadata removed.

### 3. Colony membership — request and QR

How the community forms.

**User story A.** As a **neighbor**, I want to request to join my neighborhood's colony so that I can see who lives there and help.

**User story B.** As a **caretaker**, I want to print a flyer with a QR code and post it on my block so that neighbors can join my colony in one scan.

**Scope.**
- Colony roles: `owner`, `caretaker`, `member`. Owner is whoever created the colony; caretakers can invite and manage; members can view.
- **Request flow:** a signed-in user taps "Request to join" on a public colony card. Owner/caretakers see pending requests and approve/deny.
- **QR flow:** owner/caretakers generate a signed invite token scoped to a colony and a role, with optional expiry and max-use count. The `/join/:token` route verifies and adds the scanner as a member. If they're not signed in, they sign up first and are auto-joined on completion.
- A colony surfaces its member list to members (roles visible), but not to the public.
- Members can leave; owners can remove members; owner transfer is an open question.

**Acceptance criteria.**
- A fresh user can scan a QR code, sign up, and land on the colony page as an active member in one flow (no manual approval required).
- A "request to join" notification is visible to owner/caretakers on their dashboard.
- An expired/invalid/over-used token shows a clear error and does not silently fail.
- A non-member cannot read the member list via any client route or direct API query (RLS-enforced).

### 4. TNR education + clinic directory

The content that turns a tool into a cause.

**User story A.** As a **neighbor**, I want to read a short, clear explanation of TNR so that I understand why we're not "just removing" the cats.

**User story B.** As a **caretaker**, I want to find low-cost spay/neuter clinics near me so that I can actually complete the N in TNR.

**Scope.**
- Static-ish content pages under `/learn/*` — at minimum: "What is TNR?", "Why TNR works," "How to start," "How to help without trapping." Markdown-in-repo for MVP (see [architecture.md](./architecture.md#content-pages-tnrclinics)).
- Clinic directory at `/clinics`: searchable by location/radius, showing name, address (public — clinics are not sensitive), services, cost notes, hours, website.
- Clinics are seeded manually for v1 launch regions. Community-submit is post-MVP.
- Every learn page and the clinic directory is SEO-indexable — this is a growth channel.

**Acceptance criteria.**
- All `/learn/*` pages render SSR (for SEO) with reasonable meta tags and Open Graph.
- A caretaker can filter clinics by distance from a location they type or from their current location.
- A clinic listing links to the clinic's own website where applicable, with `rel="noopener"`.

## Cross-cutting: printable flyer (part of MVP)

The flyer is the growth loop — without it, QR-scan joins have no distribution.

**Scope.**
- From the colony management page, owner/caretakers can generate a print-ready flyer: colony name, short custom message, a large QR code (scanning opens `/join/:token`), a human-readable join code, and a 3–4 line "What is TNR?" blurb.
- Rendered as an HTML print view optimized for 8.5×11" and A4 via CSS `@media print`. No PDF library for MVP.

**Acceptance criteria.**
- The flyer prints cleanly (no cropped QR) on both paper sizes.
- Scanning the QR from a printout resolves to the join page and works end-to-end.

## Parking lot (explicitly post-MVP)

Captured so we don't forget, and so we can say "no" with a pointer:

- Notifications (email, push, in-app).
- Member-to-member messaging.
- Trap-loan tracking / trap sharing.
- Feeding schedules and logs.
- Donations or payment flows.
- Public advocacy toolkit (petition templates, letter-to-neighbor generators).
- Multi-language support.
- Mobile apps (PWA-first for MVP instead).
- Community-submitted clinic listings with moderation.
- Colony merging / ownership transfer UI (a minimal admin path may be needed sooner — see open questions).
- Audit log viewer.
- API for third-party integrations.

## Open questions

- **OAuth providers.** Do we add Google/Apple sign-in in v1? Lowers friction significantly but adds config complexity.
- **Anonymous guests.** Can a completely anonymous visitor browse the fuzzed map, or do we require even an email? Trades reach for abuse resistance.
- **Photo moderation.** Do we need upfront moderation on cat photos, or is community flagging enough for v1? Feral cat photos in the wild occasionally include things that shouldn't be public.
- **Colony transfer.** When an owner stops caretaking, how do members recover? Minimum viable flow for v1?
- **Clinic verification.** Who decides a listed clinic actually does TNR at the stated price? Vetting pipeline or disclaimer?
- **Soft delete vs. hard delete.** Deceased cats — keep in timeline forever, or let caretakers purge?
