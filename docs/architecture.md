# Architecture

*How MOTION fits together, and why. Updated 25 November 2026, at `main` 5413cad.*

## The shape of it

```
 Browser (office screens)        Phone (floor app, /<workshop>/pwa)       Customer phone (share links)
          │                                 │  service worker: offline taps, cached shell
          ▼                                 ▼                                   ▼
 ┌──────────────────────────────────────────────────────────────────────────────────────┐
 │ Next.js 16.4 app (one image)                                                         │
 │  App Router pages ─ server actions ─ route handlers (/api, /api/v1 public API)       │
 │  lib/<domain>: documents · payments · stock · purchasing · fleet · requisitions ·    │
 │                notifications · time · billing · exports · handoff · storage          │
 │  forTenant(tenantId) ── Prisma 6 ── announces tenant to Postgres for RLS             │
 └───────────────────────────────┬──────────────────────────────────────────────────────┘
                                 ▼
 ┌──────────────────────────────┐   ┌──────────────────────────┐   ┌───────────────────────┐
 │ PostgreSQL 15                │   │ File storage driver      │   │ Off-site backups      │
 │ row-level security on every  │   │ local disk / S3-compat.  │   │ encrypted, restored   │
 │ tenant table                 │   │ (each file records its   │   │ in CI to prove it     │
 └──────────────────────────────┘   │  driver)                 │   └───────────────────────┘
                                    └──────────────────────────┘
 Production: one server, Docker Compose (ops/server): app · db · cloudflared tunnel → motionworkshopmanager.com
 Build: GitHub Actions on main → image at ghcr.io/gausabner/motion-workshop-manager (proven to boot against an empty database)
```

- **One codebase, one image.** The cloud service and an installed site run the same image; what differs is environment (edition, support contacts, storage driver).
- **Server actions are the write path.** Each takes the workshop slug, resolves the session and membership, checks the permission or plan feature, and runs its service function in a transaction.
- **Domain services are plain functions over a transaction** (`lib/<domain>/*.ts`), pure rules beside them (`*-rules.ts`) so they are unit-tested without a database.

## Data boundaries

- **Tenant:** every tenant-owned table carries `tenantId`. `forTenant()` adds it to every query (deny by default for unlisted models) and announces the tenant to Postgres, whose `tenant_isolation` policies enforce the same rule. New tables are added to the model list and get `ENABLE` and `FORCE ROW LEVEL SECURITY` in their migration.
- **Money:** tax is snapshotted onto each document; balances are derived from allocations and never stored.
- **People:** a `User` belongs to workshops through `Membership` (group, designations, pay number, mechanic flag). Appointments (`SigningAuthority`) and workshop staff (`WorkshopStaff`) hang off memberships.

## Decisions

### ADR-001: One database, scoped in the app and enforced by Postgres

**Status:** Accepted · **Date:** September 2026 (RLS activated November 2026)

**Context.** Hundreds of small workshops and a few large organisations share one service; a leak between tenants would end the business.

**Decision.** One Postgres database. Every query goes through `forTenant()`; row-level security policies on every tenant table refuse rows of any other tenant even if the app forgets.

| Option | Complexity | Cost | Isolation |
|---|---|---|---|
| Database per tenant | High (migrations × N) | High | Strong |
| **Shared schema, app scoping + RLS** | Medium | Low | Strong (two layers) |
| Shared schema, app scoping only | Low | Low | One bug from a leak |

**Consequences.** New tables must be registered and given policies; queries that legitimately span tenants (billing, platform admin) run with an explicit platform-admin setting. An installed site can still be a single-tenant deployment of the same image.

### ADR-002: The fleet route as stays that are handed over

**Status:** Accepted · **Date:** 19 November 2026

**Context.** A council vehicle moves through reception, the check bay, one or more workshops and bays, the quality check, and back to reception; each move is a handover with a person on each side, and the paper job card collects signatures.

**Decision.** `JobVisit` records one stay at one place: who sent it and when, who received it and when, when it left. The place it leaves sends it; the next place accepts it. Signatures are `JobSignoff` rows by stage and role. The rules (`fleet/route-rules.ts`) decide what may move where and who may sign, and a failed quality check returns the vehicle to the workshop that did the work.

**Consequences.** Where a vehicle is, and for how long, is always derivable; the route doubles as the audit trail. Moves lock the job card row so one vehicle is never sent two ways at once.

### ADR-003: Requisitions approved by appointment, not by role

**Status:** Accepted · **Date:** 20 November 2026

**Context.** A council's requisition is signed by the foreman of the asking workshop, the divisional head of the unit that runs it, and above a value limit an extra approver; the paying division's fleet coordinator is told. Roles alone cannot express "the foreman of the tyre bay".

**Decision.** `SigningAuthority` appoints a person to a kind (foreman, divisional head, fleet coordinator, over-limit approver) for a workshop or a unit, with deputies. Pure functions (`requisitions/rules.ts`) decide the candidates for each step; the screens, the actions, the tests and the notifications all ask the same functions. A stores requisition that the shelf cannot meet is split into a purchase requisition with quotations.

**Consequences.** Organisations configure their own hierarchy in Settings; "Replace" hands an appointment to someone else in one step. Signatures given stay on the record when an appointment ends.

### ADR-004: Workshop staff, and assignment per stay

**Status:** Accepted · **Date:** 25 November 2026

**Context.** A job sent to a workshop must be put on one or more of that workshop's mechanics; the job card's single Mechanic field still drives printing and the floor app.

**Decision.** `WorkshopStaff` lists who works at each workshop or bay (mechanic, artisan or intern). `VisitAssignment` puts people on a job for one stay; ended assignments are kept. The foreman, a deputy or an administrator assigns. The first person still on the job is the lead and is written to `Document.mechanicId`; saving the job card asks the route for the lead so a stale form cannot overwrite it.

**Consequences.** Everyone assigned sees the job in the floor app. History shows who worked where and when. A person can work at more than one place.

### ADR-005: Notifications written in the transaction that caused them

**Status:** Accepted · **Date:** 25 November 2026

**Context.** People need to know when a vehicle is on its way to them, when they are put on a job, when a requisition waits for their signature, and when a mechanic has finished their part.

**Decision.** In-app `Notification` rows, written inside the same transaction as the move, assignment, approval or stop reason, to the people the domain rules name (never the actor). The office bell and the floor bell poll the unread count every minute and on returning to the page; opening a notification marks it read and goes to the job or requisition.

| Option | Reach | Cost | Failure mode |
|---|---|---|---|
| **In-app list, polled** | Signed-in users | None | Seen on next look |
| Email | Anyone with an address | Mail provider; deliverability | Spam folders |
| Web push | Installed phones | Push service, permissions | Silent failures on iOS |

**Consequences.** A failed move tells nobody. Email and push remain possible later from the same rows.

### ADR-006: The floor app works without a signal

**Status:** Accepted · **Date:** R4 (September 2026), revised 25 November 2026

**Context.** Mechanics clock on in pits and yards with no signal; a tap that silently fails costs wages and trust.

**Decision.** A service worker caches the build's assets (cache-first) and the last floor page (network-first). Clock taps made offline are queued on the phone with their own time and sent idempotently when the signal returns; the card shows "Not sent yet". Undo takes back a Stop or Switch within a minute if nothing else has happened, from the queue or on the server. The worker registers only in production builds, whose asset names change with their code; on a development server it unregisters itself so edits show.

**Consequences.** Money screens are never cached. Sheets (job, schedule, notifications) need a signal and say so with a retry.

### ADR-007: One server, images built in CI

**Status:** Accepted · **Date:** October 2026

**Context.** Margins must stay above 90%, so support and infrastructure must stay small; building images on a laptop twice filled its disk.

**Decision.** GitHub Actions builds the image on every merge to `main`, proves it boots against an empty database, and publishes it. Production is one server running Docker Compose (app, Postgres, cloudflared). Deploys back up first, pull the image while the old app serves, then restart only the app; migrations run on start. Encrypted off-site backups run nightly and are restored in CI.

**Consequences.** Recovery is restore-and-start (see [continuity-and-recovery.md](continuity-and-recovery.md)). There is no staging site yet; [deploy-render.md](deploy-render.md) keeps the option.
