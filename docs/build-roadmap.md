# MOTION — build roadmap

> **The end goal:** a Namibian or South African workshop runs its entire day in MOTION — books the car in, works the job, takes the money, orders the parts, pays the supplier, and knows what it made — on one modern codebase, in its own currency and tax regime, talking to customers on WhatsApp. Feature-comparable to Workshop Software's Gold tier, better on everything local, and without thirty years of accumulated schema debt.
>
> **Where to start:** §5, R1c. Two of those items are live correctness bugs.
>
> **Basis:** [feature inventory](benchmark/workshop-software-feature-inventory.md) · [screen flows](benchmark/workshop-software-flows.md) · [API & data model](benchmark/workshop-software-data-model.md) · [PRD](../PRD.md)
> **Revised:** 8 September 2026, after running the complete money path — receivables and payables — through the live benchmark.

---

## 1. What we now know, and how well

The benchmark work went through three rounds: reading 35 saved pages, walking the live app, then **transacting in it**. That last round is what makes this plan trustworthy.

### Verified by transacting — build on these without hesitation

A priced invoice was created, processed and settled by two part-payments; a purchase order was raised and processed; a supplier invoice received stock; the supplier was paid; a credit note was raised and processed. Every figure below was read back from their API.

| Behaviour | What we saw |
|:--|:--|
| **Document lifecycle** | `O` Open → `P` Processed → `C` Closed. `C` is set automatically when `balance_due` reaches zero; a partial payment leaves it at `P` |
| **Process is a flow, not a button** | Prompted *Update Renewal Dates* modal → dedicated `PATCH …/update_vehicle_details_on_process_invoice` → *"Are you sure"* confirm |
| **Numbering** | Job number on create, invoice number on process, and by default **they are the same number**. Clean 10 000-blocks: credits 10000 · POs 20000 · customer payments 30000 · supplier payments 40000 · jobs/invoices 50000. POs number on **save**, everything else on process |
| **Stock ledger** | Customer invoice out · credit **in** · supplier invoice **in** · purchase order **not at all**. Negative stock allowed silently |
| **Payments** | Two child collections — allocations *and* **tender lines**. Tenders carry their own reference; `payment_type` is a string; `amount` vs `applied_amount` is the unapplied-credit mechanism; allocations must balance tenders before posting |
| **Payables** | Supplier invoice receives goods, matched at **line level** via `purchase_order_item_id`. `price_includes_tax` and `purchase_tax_rate` snapshotted per document. Supplier payments have **no** tender lines but **can span suppliers** |
| **Credits** | Same `invoices` table, `invoice_type` ∈ `I`/`C`/`Q`. Own sequence. Returns stock. Does **not** auto-post to the customer balance |
| **Tax** | `tax_rate`, `tax_group_id`, `discount_includes_tax`, `gst_before_discount` all snapshotted onto the document |
| **Multi-tenancy** | `company_id` on every row, stripped from list responses. `created_by` / `updated_by` / `is_deletable` everywhere |
| **Inspections** | Per-**item** approval (`approved_on`/`approved_by`); items snapshotted from the template; approved items carry the `invoice_id` they became |
| **Their stack** | Ruby on Rails (nested attributes, `_destroy`), AngularJS mid-migration to Angular, JasperReports for PDFs, SSE for list endpoints |

### Two of their bugs we must not inherit

1. **Settling a supplier invoice leaves `balance_due` stale** at the full amount while the status flips to `C` and the supplier balance correctly zeroes. Any payables report joining on `balance_due` overstates what is owed. This is the denormalised-balance failure mode, caught in the act.
2. **The renewal-dates modal fires when processing a credit note**, prompting for odometer on a document returning parts. The invoice flow applied indiscriminately.

### Still not established — do not plan around these

- **The portal's customer-facing side.** Auth, what is exposed, whether it takes payment. Reaching it means sending mail.
- **Inspection → invoice conversion**; **Apply Credits / Refund Credit** end to end; where unapplied credit is actually computed.
- **Stock-take variance application** — the count cell resisted automation, so this is inference from the variance report, not observation.
- **Split** and **Rework** — two document operations we have no model for.
- **The mobile app** — entirely unexamined.
- Price matrix internals, bundle expansion, serial numbers, loan-car cycle, diary drag-and-drop, public-booking approval queue, multi-tax and rounding, supplier credits.

> **Consequence:** everything R1c and R2 need is now specified from observation. R5 (portal, inspections, mobile) is where the unknowns cluster — probe those closer to the time, not now.

---

## 2. Where the code stands today

On `r1/foundation`, verified end to end in a browser:

- One codebase — Next.js 16 + Prisma 6 + PostgreSQL 15
- Session auth, workshop registration, six user groups, action-based permissions
- `forTenant()` scoping on every tenant-owned query, holding inside transactions
- Customers and vehicles: list, search, archive, create/edit, on real data
- The transaction document: quote → booking → job card → invoice → credit, with per-line cost, VAT-inclusive and exclusive maths (14 unit tests), atomic numbering, process / void / copy / convert / credit-note, nine job statuses with history
- Transaction Centre and jobs board on real data

**Known gaps carried forward:** customer/vehicle pickers are `<select>` and will not scale; no payments; no diary; nothing leaves the building (no PDF, no send).

---

## 3. What took them thirty years, and what we skip

| Era | Them | Us |
|:--|:--|:--|
| 1990s | Job cards, invoicing, customers, vehicles — desktop | **Inherited free** from the benchmark documents |
| 2000s | Stock, suppliers, purchasing, reporting | Inherited; mechanics now observed, not guessed |
| ~2010 | Rewrite to AngularJS SaaS | Skipped |
| 2010s | Accounting + parts integrations, native mobile | Skipped the column sprawl; `external_refs` from day one |
| Late 2010s | Inspections, public booking, reminders | Design known in advance |
| 2020s | Payments, portal, BI, multi-site, two-way SMS, website builder | Still mid-rewrite — our opening |

**The asymmetry:** they cannot absorb a new integration or vertical without widening core tables (invoice 96–148 columns, vehicle 151, company 338), and they are mid-rewrite. Our foundational bets cost days now and are effectively impossible for them to retrofit.

**What we must still earn:** trust, migration from incumbents, support, and the long tail of correctness only real workshops surface.

---

## 4. The shape of the plan

```
R1c  Foundation repair      1–2 wks   ← START HERE
R2   Money in               3–4 wks   the product becomes worth paying for
R3   Documents leave        2–3 wks   the customer sees us
R4   Time and capacity      3–4 wks   the workshop runs its day
R5   Customer-facing turn   4–5 wks   the commercial upside
R6   Margin                 3–4 wks   the owner sees profit
R7   Management and scale   ongoing
```

Each phase is chosen because it unlocks the next, not because it is the next-biggest feature.

---

## 5. R1c — Foundation repair · **start here**

Two correctness bugs and one blocker. Nothing else should be built on top until these are done.

**1. Searchable customer and vehicle pickers, with inline create.**
Our `<select>` works for nine seeded customers and is unusable at three thousand. Their pattern is two side-by-side panels with search and a `+`. Replaces the picker everywhere, including in the document editor already built.

**2. Snapshot the tax settings onto the document.** *(correctness bug)*
Today a tenant changing their VAT rate silently rewrites every historical invoice. Store `taxRate`, `pricesIncludeTax` and the tax-group reference on the document at creation, as they do.

**3. Derive balances, never denormalise them onto the document.** *(correctness bug in the making)*
Their stale supplier `balance_due` is the cautionary tale. Compute `amountDue` from allocations. Cache on the *customer* later only if measurement demands it.

**4. Complete the document state machine.** Add `CLOSED`, derived when the balance reaches zero; `PROCESSED` while partly paid.

**5. Payment model, corrected before it is built.**
- `PaymentTender` child collection — a payment holds many, each with **its own reference**
- `amount` separate from `allocated`; the difference is unapplied credit
- Invariant: allocations may not exceed tenders; any remainder is unapplied credit. We deliberately relax their exact-balance rule so a payment can be taken on account

**6. Schema decisions that are expensive to reverse.** All of these while there are no users:
- `external_refs` table instead of per-integration columns
- Vehicle vertical fields → typed JSON extras per group
- Deposits as a child collection of the document
- Line `hours` and per-line time entries
- Discount decomposition; `rounding` / `unroundedTotal`

**Done when:** a workshop with 3,000 customers can raise an invoice without a dropdown, and changing the VAT rate leaves last month's invoices untouched.

---

## 6. R2 — Money in *(3–4 weeks)*

The product currently records work but cannot take money. **No spike needed — the whole path was observed on 8 September.**

- Payment methods; payment as a document with `Save` / `Process`
- Allocation grid; picker **auto-applies the full outstanding balance** and offers **All**
- Tender lines with per-tender reference; EFT proof-of-payment attachment — **done**, on a swappable storage layer (see [file-storage.md](file-storage.md)): local disk by default, any S3-compatible bucket by config, and each file records the driver that wrote it so switching needs no migration
- Receipt numbering and PDF
- Credit notes: return stock, own sequence, **explicit** apply-or-refund — with unapplied credit surfaced on the customer, which they leave hard to derive
- Refund with a **Change** calculation for cash, plus an EFT path
- **Gate actions by state** — no credit on a settled invoice
- Customer `Account Balance` and `Unapplied Credit` in the header
- Statements with 30/60/90 ageing; Unpaid tab and receivables reports go live

**Done when:** a workshop can invoice, take a part payment by EFT, see who owes what, and send a statement.

---

## 7. R3 — Documents that leave the building *(2–3 weeks)*

Everything above is invisible to the customer until this exists.

- PDF for quote, job card, invoice, receipt, credit note, statement — letterhead, footers, templates — **done** (pdfkit, one shared layout; company profile and tax settings made real, since a letterhead needs a workshop that can enter its own details)
- Email and **WhatsApp** send, with per-document delivery state — **done** as a driver seam: `wa.me` and `mailto` hand-off drivers need no account; documents travel as expiring, revocable share links, and *opening* the link is the delivery signal (we record it). Delivery state is derived from the message log rather than stored as `emailSentAt`/`whatsappSentAt` columns. Provider drivers (WhatsApp Cloud API, SMTP) still to come once providers are chosen.
- Message templates with merge fields — their 34-template set is the checklist — **started**: document messages and printed footers are editable with a live preview; reminders and the rest of their set follow in R5
- Communication log per customer and document — **done**
- **Auto-fill the document description from line 1** (their trick; free readability everywhere) — **done**

**Done when:** the customer receives a branded invoice on WhatsApp and the workshop can see it was sent.

---

## 8. R4 — Time and capacity *(3–4 weeks)*

- Booking diary: month/week/day, **one column per mechanic**, drag to reschedule, mechanic-lane paging — **done**, plus an Unassigned lane, clashes shown rather than prevented, and pointer-event drag that works on a tablet
- Mechanic schedule, capacity, "diary full at %" — **done** (hours stored only as exceptions to the shop's; leave shaded and taken out of capacity)
- Public booking page → **approval queue**, not straight into the diary — **done**; approval recognises returning customers by mobile and plate and never moves a car off someone else's account
- Clock on/off from the PWA; time entries roll up to hours worked vs charged — **done**; one running clock per mechanic is enforced by a row lock, and efficiency counts invoiced jobs only
- Appointment types shared by internal and public booking — **done**
- **Prompt for odometer / renewal dates at process time** — branched by document type, unlike theirs — **done**; a lower reading needs a stated reason (the old code wound odometers back silently)

**Done when:** the front desk runs the day from the diary instead of a whiteboard.

---

## 9. R5 — The customer-facing turn *(4–5 weeks)*

The commercial upside. Depends on documents, sending and the diary all working. **Probe the benchmark again before starting** — this is where the unknowns are.

- Inspection groups, templates, template builder
- Inspections on the PWA with camera; **RAG as two flags**; **four input slots** per item; separate urgent/soon estimates
- **Per-item approval** with `approvedAt`/`approvedBy`; approved items convert to job lines via the item→product join and record the `documentId` they became
- Customer portal — invoices, inspections to approve, next service, rebook — **with actual configuration**: branding, what to expose, per-tenant activation. Theirs is a bare on/off flag; this is a cheap place to be visibly ahead
- Automated reminders: service due, licence disc, roadworthy, booking, quote follow-up, with sent-flags on the vehicle
- Communication Centre: segmentation and bulk send

**Done when:** a customer approves a red brake finding on their phone and it lands on the job card.

---

## 10. R6 — Margin *(3–4 weeks)*

- Stock movements ledger — **customer invoice out · credit in · supplier invoice in · PO not at all**
- Deliberate negative-stock policy (they allow it silently; we should at least warn)
- Purchase orders: `Suggested` → `On Order`, per-line due dates, **job reference on the line**
- Supplier invoices: line-level receipt via `purchaseOrderLineId`, per-document tax flags, "change sell price" on receipt
- Supplier payments: no tenders, but **multi-supplier** in one payment
- Stock take with **Save Draft**, filtered by location and item range
- Bundles / canned services; price matrix; serial numbers
- Item sales and margin reports

**Done when:** the owner can see gross profit per job and per product, and stock on hand is trustworthy.

---

## 11. R7 — Management and scale *(ongoing)*

- Full report catalogue; BI dashboards; accounting export then API sync
- CSV import suite, including a **Workshop Software migration pack** — the switching path
- **Split** (divide an invoice — insurer/customer, fleet) and **Rework** (warranty redo linked to the original)
- Public API, multi-site, offline PWA, loan cars

---

## 12. Where we deliberately beat them

| # | Ours | Theirs |
|:--|:--|:--|
| 1 | **Localised from the schema up** — VAT 15 %, N$/R, licence disc, roadworthy, 14 Namibian regions | WOF, rego, GST, AMS/Capricorn — meaningless here |
| 2 | **WhatsApp as a first-class channel** | SMS and email only |
| 3 | **Payments that work here** — EFT with proof-of-payment now, local gateway later | WorkshopPay is **not available in Africa** |
| 4 | **`external_refs`** so integrations never widen core tables | ~40 sync columns on the invoice alone |
| 5 | **Typed JSON vehicle extras per group** | 151-column vehicle carrying marine, trailer and instrument fields |
| 6 | **Balances derived from allocations** | Stale `balance_due` on settled supplier invoices — observed |
| 7 | **Portal with configuration** | A bare on/off licence flag |
| 8 | **Action-based permissions** — invoice but not void; hide cost from mechanics | 28 entity on/off toggles that express neither |
| 9 | **One modern codebase** | Mid-rewrite, two Angulars on the same page |
| 10 | **Offline-tolerant PWA**; consistent confirm dialogs; process flow branched by document type | Native app needing connectivity; `No/Yes` here, `Cancel/Yes` there; renewal prompt on a credit note |

---

## 13. Sequencing rules we hold to

1. **Correctness before features.** The tax snapshot ships before payments, because posted history must be immutable.
2. **Every slice reaches a staging URL with real data before the next begins.** No slice is done because it compiles.
3. **Schema decisions that are expensive to reverse get made in R1c**, while there are no users.
4. **Copy the flow, never the widget.** Their interaction model is 2010-era AngularJS; the *shape* of the flow is what thirty years bought them.
5. **Anything touching money gets a unit test before it gets a screen.** The document maths has 14; payments and stock get the same.
6. **Probe before designing what we have not observed** — R5 only.
