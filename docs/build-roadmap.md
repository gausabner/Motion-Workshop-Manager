# MOTION — build roadmap

> **What this is:** how we get from where the code is today to a product that beats Workshop Software in our market, and the reasoning behind the order.
> **Basis:** [feature inventory](benchmark/workshop-software-feature-inventory.md) · [screen flows](benchmark/workshop-software-flows.md) · [API & data model](benchmark/workshop-software-data-model.md) · [PRD](../PRD.md)
> **Date:** 8 September 2026

---

## 1. Confidence in the benchmark findings

Not everything in those three documents is equally well established. Before committing to a plan, here is what we actually know.

### Verified directly — build on these without hesitation

| Finding | How it was established |
|:--|:--|
| The nine job statuses and their codes | Read from `/system/job_status_types` |
| Invoice status `Open / Processed / Closed`, with `voided` a separate flag | Read from `/system/invoice_status_types` |
| Inspection status `Draft / Requested Approval / Approved / Refused / Finalized` | Read from `/system/inspection_status_types` |
| Table widths — vehicles 151, invoices 148, customers 104, products 83, company 338 | Enumerated field-by-field from live records |
| Tax settings, cost and balance are stored on the invoice header | Column list of a real invoice record |
| Per-item inspection approval (`approved_on`, `approved_by`) and item→invoice linkage | Column list of a real inspection's items |
| Template items are snapshotted (44 copied, each with `template_item_id`) | Created a real inspection and read it back |
| Lines save with the document, not individually | Adding a line produced zero network traffic |
| Lists stream as SSE; paging/sorting in the URL path | Response headers and URL patterns |
| `company_id` is the tenant key; `created_by`/`updated_by`/`is_deletable` on every row | Diffed single-record vs list responses |
| Each accordion section is its own paginated endpoint | 19 requests observed on one customer open |
| Backend is Ruby on Rails | `*_attributes` + `_destroy` nested-attribute markers |
| The full IA, every menu, and the 134 routes | Walked every screen; read the router state table |

### Inferred with good evidence — likely right, cheap if wrong

- **Why** they denormalise `cost` and `balance_due` onto headers: almost certainly to make the dashboard and receivables queries fast. The alternative explanation — that it is simply old code — does not change what we should do.
- `stock_variance_performed` is an idempotency guard on stock movement at process time. Named clearly, but I never processed an invoice to watch it fire.
- The portal is a separate front end. Strong evidence (no route, no other host in the bundles) but not proven; I declined to probe their web server for it.
- `Closed` means fully settled. Reasonable from the name and from `balance_due`, not confirmed against a paid invoice.

### Now verified — the money path *(updated 8 September 2026)*

The three largest gaps below have since been closed by running a priced invoice through process and settling it with two part-payments. See [§9 of the data-model document](benchmark/workshop-software-data-model.md). In summary:

- **Process** is a three-step flow — a prompted *Update Renewal Dates* modal, a dedicated `PATCH …/update_vehicle_details_on_process_invoice`, then a confirm. It numbers from the JOB sequence (invoice number **equals** job card number by default), jumps `job_status` straight to Finalised, auto-fills the description from line 1, writes the denormalised customer balance, and **decrements stock, allowing it to go negative silently**.
- **Payments** are documents with **two** child collections — allocations and **tender lines**. Tenders carry their own `reference`, `payment_type` is a string not an FK, and `amount` vs `applied_amount` is the unapplied-credit mechanism. Allocations must balance tenders before posting.
- **Settlement**: partial payment leaves the invoice at `P`; full settlement flips it to `C` with `balance_due` 0. `stock_variance_performed` was **not** present on the invoice record — that earlier note was wrong, and stock movement is not guarded by a flag on the invoice.

This adds three schema changes to R1c/R2 that were not in the original plan: **tender lines on the payment**, **`reference` per tender**, and **`amount` separate from `allocated`**.

### Still not established — do not plan around these

- **The portal's customer-facing side.** Everything in §8 is the *workshop* side. What the customer sees, how they authenticate, and whether it can take payment remain unknown — the portal is a separate application reached only by a link inside a sent email.
- Inspection → invoice conversion; credit notes, refunds and apply-credit.
- The entire payables side: supplier invoices, purchase orders, supplier payments.
- Stock take, price matrix internals, bundles.
- Report output, BI dashboards, statements.
- **The mobile app was not examined at all.**
- Booking-diary drag-and-drop, and public booking request approval.
- Multi-tax combination and rounding behaviour when enabled.

> **Consequence for planning:** the schema changes in §3 rest almost entirely on verified findings and are safe to commit to now. Process and payment allocation have since been observed directly, so R2 no longer needs a spike. The portal still does — and it is the one slice where we should expect surprises.

### Confidence in the schema changes themselves

| Change | Confidence | Why |
|:--|:--|:--|
| Snapshot tax settings onto the document | **High** | Verified they do it, and it fixes a live correctness bug in ours regardless of what they do |
| Add `CLOSED` document state | **High** | Verified enum; receivables needs it |
| `external_refs` table instead of per-integration columns | **High** | Their 148-column invoice is the counter-example, in evidence |
| Store discount decomposition | **High** | Verified columns; needed for the printed document |
| Per-item inspection approval + item→product join | **High** | Verified from a real inspection |
| Vehicle extras as typed JSON by group | **Medium-high** | The problem is verified; our specific remedy is a judgement call |
| Rework and invoice-split modelling | **Medium** | Columns verified, semantics inferred. Cheap now, so worth doing |
| `rounding` / `unroundedTotal` | **Medium** | Verified columns; matters only once a tenant turns rounding on |
| Cached customer balance | **Medium** | They do it; whether we need it depends on our query volume. Defer until measured |

---

## 2. What took them thirty years, and what we can skip

Workshop Software accreted in the order the market pulled it, on the technology of each era:

| Era | What they added | Cost to them |
|:--|:--|:--|
| 1990s | Job cards, invoicing, customers, vehicles — desktop | The core domain, learned from scratch |
| 2000s | Stock, suppliers, purchasing, reporting | Warehouse and accounting complexity |
| ~2010 | Rewrite to a web app (AngularJS), multi-tenant SaaS | A full rewrite |
| 2010s | Accounting and parts integrations, native mobile app | Column sprawl across every core table |
| Late 2010s | Inspections, public booking, reminders | The customer-facing turn |
| 2020s | Payments, portal, BI, multi-site, two-way SMS, website builder | A second rewrite, still unfinished (AngularJS → Angular) |

**We inherit the domain model for free.** The three benchmark documents are thirty years of hard-won domain knowledge — the nine job statuses, the single transaction document, cost on every line, per-item inspection approval — recovered in a day. That is the single largest saving available to us, and it is already banked.

**What we skip entirely:** the DOS-era migration, the AngularJS rewrite, the second rewrite they are in the middle of now, twenty years of AU/US parts-catalogue integrations, and the discovery cost of learning what a workshop needs.

**What we must still earn:** trust, data migration from incumbents, support, and the long tail of small correctness details that only real workshops surface.

**The asymmetry to exploit:** their architecture cannot absorb new integrations or verticals without widening core tables, and they are mid-rewrite. Our foundational bets — `external_refs`, typed JSON extras, normalised contacts, row-level tenancy, snapshotted tax — cost us days now and are effectively impossible for them to retrofit.

---

## 3. Where the code stands today

Done and verified on `r1/foundation`:

- One codebase: Next.js 16 + Prisma 6 + PostgreSQL 15
- Session auth (bcrypt, DB sessions, httpOnly cookie), workshop registration, six user groups, action-based permission matrix
- `forTenant()` scoping on every tenant-owned query, verified to hold inside transactions
- Customers and vehicles: list, search, archive, create/edit, on real data
- The transaction document: quote → booking → job card → invoice → credit, with lines, per-line cost, VAT-inclusive and exclusive maths (14 unit tests), atomic per-tenant numbering, process / void / copy / convert / credit-note, nine job statuses with history
- Transaction Centre and jobs board on real data
- Verified end to end in the browser: booking → job card → invoice `INV-1001`, vehicle service record updated, credit note negated

Known gaps carried forward: customer/vehicle pickers are `<select>` and will not scale; no payments; no diary; no documents leave the building (no PDF, no send).

---

## 4. The build sequence

The order is dependency-driven, not feature-driven. Each phase is chosen because it unlocks the next.

### R1c — Foundation repair *(1–2 weeks)*
**Why first:** two of these are correctness bugs, and the picker blocks every screen built after it.

- Searchable customer and vehicle pickers with inline create — replaces `<select>` everywhere
- **Snapshot `pricesIncludeTax` + tax rate onto the document** — today a tenant changing VAT silently rewrites history
- Add `CLOSED` to the document state machine
- Store the discount decomposition; add `rounding` / `unroundedTotal`
- Introduce `external_refs`; move vehicle vertical fields to typed JSON extras
- Line `hours` column and per-line time entries

**Done when:** a workshop with 3,000 customers can raise an invoice without a dropdown, and changing the VAT rate leaves last month's invoices untouched.

### R2 — Money in *(3–4 weeks)*
**Why now:** the product currently records work but cannot take money. This is the shortest path to a system a workshop would actually pay for.

- Payment methods; payment as a document (`Save` / `Process`)
- **Tender lines** — a payment holds many, each with its own reference; allocations must balance tenders before posting
- Allocation grid across open invoices; the picker auto-applies the full outstanding balance and offers **All**
- `amount` separate from `allocated`, so money taken but unallocated becomes unapplied credit
- `CLOSED` derived when `balance_due` reaches zero; partial payment leaves the invoice `PROCESSED`
- EFT proof-of-payment attachment and reference; receipt numbering and PDF
- Deposits and credit notes; apply-credits as its own screen
- Customer `Account Balance` and `Unapplied Credit` in the header
- Statements with 30/60/90 ageing
- Unpaid tab and receivables reports go live

**No spike needed** — the whole path was observed on 8 September 2026 and is specified in §9 of the data-model document.

**Done when:** a workshop can invoice, take a part payment by EFT, see who owes what, and send a statement.

### R3 — Documents that leave the building *(2–3 weeks)*
**Why now:** everything above is invisible to the customer until this exists.

- PDF rendering for quote, job card, invoice, receipt, credit note, statement — letterhead, footers, templates
- Email and WhatsApp send, with per-document delivery state (`emailSentAt`, `smsSentAt`, `contactedAt`)
- Message templates with merge fields (`{{customer_first_name}}` and the rest of their 34-template set)
- Communication log per customer and document

**Done when:** the customer receives a branded invoice on WhatsApp and the workshop can see it was sent.

### R4 — Time and capacity *(3–4 weeks)*
- Booking diary: month/week/day, one column per mechanic, drag to reschedule
- Mechanic schedule (working hours, exceptions), capacity and "diary full at %"
- Public booking page → **approval queue**, not straight into the diary
- Clock on/off from the PWA; time entries roll up to `hoursWorked` vs `hoursCharged`
- Appointment types shared by internal and public booking

**Done when:** the front desk runs the day from the diary instead of a whiteboard.

### R5 — The customer-facing turn *(4–5 weeks)*
**Why here:** this is where the commercial upside is, and it depends on documents, sending and the diary already working.

- Inspection groups, templates, and the template builder
- Inspections on the PWA with camera; RAG as two flags; four input slots per item
- **Per-item approval** with `approvedAt` / `approvedBy`, and approved items converting to job lines via the item→product join
- Customer portal — invoices, inspections to approve, next service, rebook — **with actual configuration**: branding, what to expose, per-tenant activation
- Automated reminders: service due, licence disc, roadworthy, booking, quote follow-up, with sent-flags on the vehicle
- Communication Centre: segmentation and bulk send

**Done when:** a customer approves a red brake finding on their phone and it lands on the job card.

### R6 — Margin *(3–4 weeks)*
- Stock movements ledger; process moves stock, guarded for idempotency
- Stock take as draft → process
- Supplier orders, supplier invoices and payments
- Bundles / canned services; price matrix; serial numbers
- Item sales and margin reports

**Done when:** the owner can see gross profit per job and per product, and stock on hand is trustworthy.

### R7 — Management and scale *(ongoing)*
- The full report catalogue; BI dashboards; accounting export then API sync
- CSV import suite, including a **Workshop Software migration pack** — the switching path
- Public API, multi-site, offline PWA

---

## 5. Where we deliberately beat them

These are not "nice to have". They are the reasons a Namibian or South African workshop would choose us.

| # | Ours | Theirs |
|:--|:--|:--|
| 1 | **Localised from the schema up** — VAT 15%, N$/R, licence disc, roadworthy, 14 Namibian regions, Afrikaans document labels | WOF, rego, GST, AMS/Capricorn — bolted on for AU/NZ, meaningless here |
| 2 | **WhatsApp as a first-class channel** | SMS and email only |
| 3 | **Integrated payments that actually work here** — EFT with proof-of-payment now, a local gateway later | WorkshopPay is **not available in Africa** |
| 4 | **`external_refs`** so integrations never widen core tables | 148-column invoice, ~40 of them sync bookkeeping |
| 5 | **Typed JSON vehicle extras per group** | 151-column vehicle carrying marine, trailer and instrument fields |
| 6 | **Portal with configuration** — branding, what to expose | A bare on/off licence flag |
| 7 | **Action-based permissions** — invoice but not void; hide cost from mechanics | 28 entity on/off toggles that cannot express either |
| 8 | **One modern codebase** | Mid-rewrite, AngularJS and Angular on the same page |
| 9 | **Offline-tolerant PWA** for the workshop floor | Native app requiring connectivity |
| 10 | **Normalised contacts, allocations and audit** | `contact1_*`, `contact2_*` inline; balances denormalised |

---

## 6. Sequencing rules we will hold to

1. **Correctness before features.** The tax snapshot ships before payments, because posted history must be immutable.
2. **Every slice reaches a staging URL with real data before the next begins.** No slice is done because it compiles.
3. **Spike behaviour we have not observed.** Payments, process-time stock, and the portal each begin with an hour against the live benchmark, with data in it.
4. **Schema decisions that are expensive to reverse get made now.** `external_refs`, JSON extras, snapshotting, normalised children — all in R1c, while there are no users.
5. **Copy the flow, never the widget.** Their interaction model is 2010-era AngularJS; the *shape* of the flow is what thirty years bought them.
6. **Anything that touches money gets a unit test before it gets a screen.** The document maths has 14; payments and stock will get the same treatment.
