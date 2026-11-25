# MOTION Workshop Manager

Workshop management for motor trades and the organisations that run their own fleets — Namibia first, South Africa second. It is benchmarked feature by feature against Workshop Software; see [PRD.md](PRD.md) and [docs/benchmark](docs/benchmark/workshop-software-feature-inventory.md).

Live at **https://motionworkshopmanager.com**. Product context is in [PRODUCT.md](PRODUCT.md), the design system in [DESIGN.md](DESIGN.md), and how the pieces fit in [docs/architecture.md](docs/architecture.md).

## What it does

| Area | What is built |
|:--|:--|
| The workshop's day | Diary, job cards, quotes to invoices, receipts, refunds, credit notes, sending by share link (WhatsApp or email), what customers owe |
| Parts and buying | Stock, purchasing and suppliers, stores and purchase requisitions with quotations and sign-offs |
| Fleet route | A vehicle's route through reception, the check bay, workshops and bays, the quality check and collection, with the job card's signatures |
| People | Workshop staff (mechanics, artisans, interns), foremen and deputies, assigning people to a job at a workshop, the mechanic clock |
| The floor app (`/<workshop>/pwa`) | A mechanic's jobs, the job sheet, schedule, today's figures, Undo, notifications; works without a signal |
| Notifications | Vehicles on their way, jobs you are put on, requisitions waiting for your signature, work finished |
| Owner and audit | Management reports, the six audit reports, accounting integration, the public API, every table as CSV |

Plans: **Workshop** (N$ 1,200 a month), **Full workshop** (N$ 2,400), and **Fleet and multi-site** (quoted per site), all excluding VAT. Which plan opens what lives in `web/src/lib/plans/features.ts`.

## Stack

One codebase in `web/`: **Next.js 16.4** (App Router, server actions, React 19), **Prisma 6** on **PostgreSQL 15**, **Tailwind CSS 4** and the **UI SDK** (`@ui-sdk/react`) for accessible components. Session auth with bcrypt and an httpOnly cookie. Every tenant-owned query goes through `forTenant()`, and Postgres row-level security enforces the same boundary underneath.

```
web/            the app (src/app routes, src/lib domain code, prisma/ schema and migrations, e2e/ browser tests)
ops/            the production server's compose file, units and backup scripts
docs/           plans, guides, runbooks and policies (index below)
References/     saved pages of the benchmark product (not shipped)
```

## Run it locally

Prerequisites: Node 24, Docker Desktop.

```bash
docker compose up -d db                 # Postgres on :5432
cd web && cp .env.example .env          # set SESSION_SECRET (openssl rand -hex 32)
npm install                             # also runs prisma generate
npm run db:migrate                      # apply migrations
npm run db:seed                         # demo workshop "TipTop AutoCare"
npm run dev                             # http://localhost:3000
```

Sign in as `admin@motion.com` / `admin` → `/tiptop/dashboard`. The floor app is at `/tiptop/pwa`. On the development server the floor app does not register its offline worker, so code changes show on reload.

## Tests

| Command | What it runs |
|:--|:--|
| `npm test` | Unit tests (`*.test.ts`, node:test) |
| `npm run test:ui` | Component tests (`*.ui.test.tsx`, Vitest and jsdom) |
| `npm run test:db` | Database tests (`*.dbtest.ts`) against Postgres; load `.env` first |
| `npx playwright test` | Browser tests against a production build on port 3011, desktop and phone |

CI runs all of them, the image build and the backup-script tests on every pull request to `main`.

## Deploying

Merging to `main` builds the image and publishes it to `ghcr.io/gausabner/motion-workshop-manager`. Production is one server running Docker Compose from `ops/server`, reached through a Cloudflare tunnel. The order — back up, pull the image while the old app serves, restart only the app — is in [docs/launch-runbook.md](docs/launch-runbook.md). Migrations run when the app starts.

## Where things are

| Concern | Path |
|:--|:--|
| Data model | `web/prisma/schema.prisma` |
| Auth and sessions | `web/src/lib/auth/` |
| Tenant scoping | `web/src/lib/tenant-db.ts` |
| Permissions matrix | `web/src/lib/auth/permissions.ts` |
| Plans and features | `web/src/lib/plans/features.ts` |
| Fleet route and crew | `web/src/lib/fleet/` |
| Requisitions | `web/src/lib/requisitions/` |
| Notifications | `web/src/lib/notifications/` |
| Floor app | `web/src/components/pwa/`, `web/src/lib/time/` |
| Domain modules | `web/src/lib/<module>/{schema,queries,actions}.ts` |
| Route guard | `web/src/proxy.ts` |

## Documents

| Document | For |
|:--|:--|
| [docs/architecture.md](docs/architecture.md) | How the system fits together, and the decisions behind it |
| [docs/staff-guide.md](docs/staff-guide.md) | MOTION staff running billing and support |
| [docs/launch-runbook.md](docs/launch-runbook.md) | Deploying and operating production |
| [docs/implementation-pack.md](docs/implementation-pack.md), [docs/integration-guide.md](docs/integration-guide.md), [docs/public-api.md](docs/public-api.md) | A customer going live and connecting their systems |
| [docs/security-whitepaper.md](docs/security-whitepaper.md), [docs/data-protection.md](docs/data-protection.md), [docs/continuity-and-recovery.md](docs/continuity-and-recovery.md) | Procurement, IT and data protection reviews |
| [docs/compliance-check-2026-11.md](docs/compliance-check-2026-11.md), [docs/legal-review-2026-11.md](docs/legal-review-2026-11.md) | The November 2026 compliance check and terms review |
| [docs/fleet-job-flow-plan.md](docs/fleet-job-flow-plan.md), [docs/requisitions-plan.md](docs/requisitions-plan.md) | The fleet route and requisitions, as planned and as built |
| [docs/floor-app.pdf](docs/floor-app.pdf), [docs/floor-app-plan.pdf](docs/floor-app-plan.pdf) | The floor app as built, with real screens; and the plan it was built from |
| [docs/brand/motion-brand-board.pdf](docs/brand/motion-brand-board.pdf) ([PNG](docs/brand/motion-brand-board.png)) | MOTION's brand on one board: mark, construction, colour, type, applications |
| [docs/registration-and-billing.md](docs/registration-and-billing.md), [docs/exports-plan.md](docs/exports-plan.md), [docs/file-storage.md](docs/file-storage.md) | How registration, exports and storage work |
| [docs/build-roadmap.md](docs/build-roadmap.md), [docs/website-and-market-plan.md](docs/website-and-market-plan.md), [docs/content-plan.md](docs/content-plan.md) | Roadmap, market and wording |
| [docs/ui-sdk-component-plan.md](docs/ui-sdk-component-plan.md), [docs/design-audit-2026-10-20.md](docs/design-audit-2026-10-20.md), [docs/progress-and-steps.md](docs/progress-and-steps.md) | Design records |
| [docs/deploy-render.md](docs/deploy-render.md) | Superseded: the Render option kept for a future staging site |
