# Catlas — Vision

> Bringing the community to community cats.

## Mission

Catlas helps neighborhoods coordinate Trap-Neuter-Return (TNR) for feral and free-roaming cat colonies. By making colonies visible (safely), memberships easy to join, and TNR knowledge accessible, we aim to reduce feral overpopulation through community coordination rather than isolated effort.

## The problem

TNR works — but it is under-coordinated:

- **Caretakers work alone.** The person feeding a colony rarely knows their neighbor is doing the same, or has traps, or knows a low-cost clinic.
- **Newcomers can't find who's responsible.** A resident who notices a colony often doesn't know whether anyone is already caring for it, whether to help, or whether to call animal control (which can be fatal for the cats).
- **Clinics are hard to find.** Low-cost TNR clinics exist in most regions but are scattered across outdated websites, Facebook groups, and word-of-mouth.
- **Neighborhood awareness is low.** Feral cats are frequently misunderstood; caretakers lack ready-made tools to educate neighbors.

## Target users

| Persona | Who they are | Primary need |
| --- | --- | --- |
| **Caretaker** | Feeds and/or traps an existing colony. Often self-funded, self-taught. | A place to record cats, track TNR status, and find other caretakers nearby. |
| **Neighbor / community member** | Notices a colony, wants to help (or at least not harm). | A low-friction way to connect with the caretaker, learn about TNR, and opt into a local colony. |
| **TNR advocate / rescue group** | Organizes across multiple colonies; trains caretakers. | Oversight of multiple colonies, clinic referrals, volunteer coordination. |
| **Clinic / resource provider** | Low-cost spay/neuter clinic, trap-loan program, rescue. | Discoverability — be listed where caretakers are already looking. |

## Value proposition

- **For caretakers:** keep a living record of your colony, find neighbors already helping, and recruit more hands via QR-coded flyers.
- **For neighbors:** know whether someone is caring for the colony outside your window, and join them in two taps.
- **For advocates:** a shared map and shared vocabulary across the caretakers you support.
- **For clinics:** free listing in a directory the caretakers you serve will actually open.

## Non-goals (v1)

Catlas is **not**:

- a general cat-adoption platform,
- a lost-pet tracker,
- a donation or fundraising platform,
- a veterinary records system,
- a messaging / chat app (beyond what's needed to run a colony).

Drift into any of these dilutes the product and invites scope we can't sustain. They belong in the parking lot, not the roadmap.

## Success signals

No hard KPIs yet — we're still exploring. Qualitative signals we'll watch:

- Colonies registered per active region.
- Average members per colony (does "community" actually form?).
- QR-scan → join conversion rate (does the flyer growth loop work?).
- Clinic directory completeness and freshness in launch regions.
- Retention of caretakers at 30 / 90 days.

## Ethical guardrails

Mapping feral cat locations is **sensitive data**. Colonies have been harmed by hoarders, people who dislike cats, and well-meaning strangers who trap and remove them. Our posture:

- **Exact colony coordinates are never exposed to non-members.** Public users see a fuzzed area, not a pin. This is enforced at the database, not the UI. See [architecture.md](./architecture.md) and [data-model.md](./data-model.md).
- **Cat photos strip EXIF GPS on upload.** A photo should not leak what the map hides.
- **Membership gates caretaker-level detail.** Cat profiles, exact locations, and colony notes require joining.
- **Caretakers can delete their data.** Full hard-delete of colonies and cats they own, with clear UX.
- **Moderation-ready from day one.** We expect to need reports/flags as usage grows — structure the schema to support it even if the UI is minimal.

## Open questions

- **Geographic launch scope.** One city, one country, global-but-sparse? Affects clinic directory strategy and tile-provider costs.
- **Moderation model.** Self-serve with flagging, or vetted regional admins? Fully open invites abuse; fully vetted doesn't scale.
- **Disputed colony ownership.** What happens when two people both claim to be the primary caretaker of the same colony? Merge flow? Co-ownership?
- **Anonymous browsing.** Should the fuzzed public map work without any account, or require at least an email? Trades reach for abuse-resistance.
- **Partnerships.** Do we seek explicit partnerships with established TNR organizations, or stay grassroots? Affects brand, legal posture, and feature priorities.
