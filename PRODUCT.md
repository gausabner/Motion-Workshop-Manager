# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## What it is

MOTION Workshop Manager is workshop-management software for motor trades in
Namibia first and South Africa second: the diary, job cards, invoicing,
payments, parts, purchasing and customer communication a workshop runs its day
on. It is benchmarked feature-by-feature against Workshop Software
(workshopsoftware.com), which is the incumbent in this market.

Built as one Next.js 16 codebase in `web/` (Prisma 6, Postgres 15). Feature
areas R1–R7 are complete: documents, money in and out, printing, sending,
diary, inspections, reminders, stock, purchasing, loan cars, a public API and
an offline floor app.

## Users and jobs

- **Service advisor / owner (primary).** At a counter, interrupted constantly,
  often with a customer in front of them or on the phone. Books the job, turns
  a quote into a job card into an invoice, takes payment, chases what is owed.
  Speed and not losing their place matter more than anything.
- **Mechanic.** On the floor, hands dirty, using a phone or a shared tablet.
  Clocks on and off jobs, records inspection findings. Uses the installable
  offline app (`/pwa`), which queues taps when the network drops.
- **Bookkeeper / office.** Reconciles payments, runs the accounting export,
  works the payables and receivables reports.
- **Customer.** Never logs in. Receives an expiring share link by WhatsApp or
  email to approve an inspection, view a document, or reach a portal.

## Delivery: two kinds of client

Confirmed 22 Sep 2026. These are equal first-class targets, not one plus an
afterthought.

- **Installed (on-premise).** Municipalities, regional and town councils, brand
  workshops, bodywork and fitment shops, MOT garages. MOTION runs on their own
  network. **Sites are always connected to the internet.** Patching, upgrades
  and backups are done **remotely by the MOTION team**, not by the client's IT.
- **Cloud (web app).** Local garages and workshops with an online presence,
  using MOTION as a hosted service.

**Commercial model: subscription for both**, installed sites included.

## Durable constraints

- **Tenancy.** Multi-tenant on a `Tenant` model; 54 of 56 tables carry
  `tenantId`. Path-based routing (`/{tenant}/dashboard/…`), no subdomains.
  Scoping is enforced in the app by a deny-by-default Prisma extension
  (`forTenant`), and in Postgres by row-level security policies that are in
  place but dormant until the app connects as a non-superuser.
- **Money is the product.** Every screen is somebody's books. Tax is
  snapshotted onto each document; balances are derived from allocations and
  never stored. Being plainly down beats being quietly wrong.
- **Region.** Namibia and South Africa: 15 % VAT, N$ / R, licence disc and
  roadworthy, WhatsApp-first customer contact, timezone and currency set by the
  country chosen at registration.
- **Sending has no account requirement.** Documents go out as expiring,
  revocable share links handed off to `wa.me` or `mailto`. Opening the link is
  the delivery signal.
- **Storage is swappable.** One driver interface; local disk by default,
  S3-compatible by configuration, each file recording the driver that wrote it.
- **Offline floor app.** The PWA caches build assets and the last `/pwa` page
  only — never money screens — and queues clock events idempotently.

## Terminology

Workshop (the business), tenant (its data boundary), job card, quote, invoice,
credit note, receipt, refund, booking diary, courtesy car, inspection,
share link, job card "on the floor".

## Open decisions

- Where cloud staging and production are hosted. Undecided as of 22 Sep 2026.
- Subscription price points and enforcement mechanism for installed sites.
- Whether the visual identity is refined or replaced (both directions were
  requested for comparison on 22 Sep 2026).
