# Benchmark: Workshop Software — API and stored data model

> **Method:** on 8 September 2026, with the account owner's explicit permission, labelled test records were created in the live **MEGA AutoWorks** trial (`ZZTEST Probe Customer`, vehicle `ZZTEST001`, one draft invoice) and the resulting API traffic and record shapes were read back. No messages were sent, no subscription or module was activated, no existing record was modified or deleted.
> **Companions:** [feature inventory](workshop-software-feature-inventory.md) · [screen flows](workshop-software-flows.md) · [PRD](../../PRD.md)

---

## 1. API shape

Base: `https://api.workshopsoftware.com`. Session cookie auth. Datadog RUM on the front end.

**Lists stream as Server-Sent Events.** `Content-Type: text/event-stream`, body `data: [ …rows… ]`. Not JSON. Reference/enum endpoints (`/system/*`) return ordinary JSON.

**Pagination, sorting and filtering live in the URL path, not the query string**, with `*` as the wildcard:

```
GET /filters/*/vehicles/0/10/plate_number/asc/false
        │     │        │ │  │             │   └ archived?
        │     │        │ │  └ sort field   └ direction
        │     │        │ └ limit
        │     │        └ offset
        │     └ entity
        └ filter (* = none)

GET /customers/invoice_list_with_find/{id}/0/5/*/*/*/*/post_date/desc/*
GET /customers/payment_list/{id}/0/5/post_date/asc
GET /customer/biller_account_balance/{id}
GET /customer/biller_credit_balance/{id}
GET /customer_activity_logs/{id}/5/0
POST /customers/verify_name_uniqueness      ← live duplicate check while typing
POST /vehicles    POST /invoices            ← plural collections
```

**Each accordion section on a record screen is its own paginated endpoint.** Opening one customer fired **19 requests**: the record, balance, credit balance, biller children, and one call each for vehicles, invoices, quotes, payments, events, inspections and the activity log — plus reference data (`/company`, `/company_message_settings`, `/tax_groups`, `/system/invoice_status_types`, `/system/ams_autoclubs`). This is why lazy accordions work: sections are independent and each carries its own `offset/limit/sort`.

**Document lines are not saved individually.** Adding a line to an invoice produced *zero* network traffic; the whole document with its items goes up in one `POST /invoices`. Our editor already works this way.

---

## 2. Canonical enumerations

Every enum is `{id, code, description, language_label}` — a short code plus an i18n key.

**Job status** (`/system/job_status_types`) — nine, and our `JobStatus` matches them one for one:

| Code | Description |
|:--|:--|
| `B` | Booked In |
| `W` | Work In Progress |
| `P` | Waiting For Parts |
| `I` | Inspection In Progress |
| `U` | Waiting For User Approval |
| `C` | Job Complete |
| `N` | Customer Notified |
| `A` | Complete – Awaiting Finalise |
| `F` | Finalised |

**Invoice status** (`/system/invoice_status_types`): `O` Open · `P` Processed · `C` Closed.
Voiding is a **separate boolean** (`voided`), not a status. So the real lifecycle is *Open → Processed → Closed*, with `voided` and `refunded` as orthogonal flags.

> **Gap in ours:** we have `DRAFT / PROCESSED / VOID`. We have no **Closed** — the state where a processed invoice has been fully settled. Worth adding when payments land, since "open invoices" is the query the whole receivables side depends on.

**Inspection status** (`/system/inspection_status_types`): `D` Draft · `RA` Requested Approval · `A` Approved · `R` Refused · `F` Finalized. That is the R2 inspection lifecycle, specified.

---

## 3. Table widths

| Table | Columns |
|:--|--:|
| `vehicles` | **151** |
| `invoices` | **148** |
| `customers` | **104** |
| `products` | 83 |
| `users` | 76 |
| `vendors` | 61 |
| `mechanics` | 12 |

These are wide single tables, not normalised. Roughly a third of every table is integration bookkeeping. The shape of `invoices` is representative:

- **~45 core domain columns** — the actual invoice
- **~40 accounting-sync columns** — `qbo_id`, `needs_qbo_sync`, `qbo_sync_token`, `xero_sync_status`, `myob_id`, `needs_myob_sync`, `sage_id`, `needs_sage_sync`, `sage_one_aus_id`, `needs_netsuite_sync`, `needs_carfax_sync`, `needs_castrol_sync`, `needs_ams_sync`, `needs_net_promoter_score_sync` …
- **~20 payment-gateway columns** — `stripe_payment_intent_id`, `stripe_client_secret`, `stripe_fee_percentage/amount/tax/subtotal`, `tillpayments_payment_request_id`, `tillpayments_redirect_url`, `tillpayments_terminal_payment_intent_id`, `tillpayments_surcharge_amount/percentage/subtotal/tax`, `tillpayments_reversal_invoice_id`, `takepayments_payment_request_id`, `flippay_payment_request_id`, `tnp_invoice_id`, `tnp_invoice_paid`
- **~10 parts-supplier note columns** — `repco_note`, `prolink_note`, `bursons_note`, `oscar_note`, `supercheap_note`, `ashdown_ingram_note`, `hsy_quote_number`, `current_bursons_order`, `current_supercheap_order`, `current_oscar_order`

> **Lesson:** every integration they ever shipped added columns to the core tables. Thirty years of that produces a 148-column invoice. **Our equivalent must be an `external_refs` table** — `(tenant_id, entity_type, entity_id, system, external_id, sync_state, synced_at)` — so integrations never widen `documents`.

The same applies to verticals. `vehicles` carries, in one table: marine (`marine_berths`, `marine_cabins`, `marine_beams`, `marine_drafts`, `marine_hull_type`, `marine_hull_material`, `marine_marina_location`), trailers (`trailer_plate_number`, `trailer_vin`, `trailer_make`, `trailer_model`, `trailer_notes`), musical instruments and equipment (`instrument_condition`, `case_condition`), and **four complete engine blocks** (`engine_number_2/3/4`, `engine_make/model/code/cylinders/litres/fuel_type/hours` ×3) for multi-engine boats. Our answer should be core columns plus a typed JSON extras document keyed by vehicle group.

`products` follows the pattern: ~35 core columns, a tyre block (`tyre_size`, `tyre_brand`, `tyre_model`, `tyre_identification_number`, `tyre_mspn`, `tyre_width`, `tyre_profile`, `wheel_size`, `universal_product_code`), and ~25 supplier-SKU columns.

---

## 4. What the invoice record teaches us

Selected columns from `invoices`, with what they imply:

| Column | Implication |
|:--|:--|
| `cost`, `cost_including_tax` | **Total cost is stored on the header**, not computed. That is why the dashboard shows profit instantly. |
| `balance_due` | Denormalised onto the invoice. Likewise `balance` and `credit_balance` on the customer. |
| `tax_rate`, `price_includes_tax`, `tax_group_id`, `multi_tax_combined_rate` | **Tax settings are snapshotted onto the document.** Changing the company VAT rate later cannot retroactively alter posted invoices. |
| `discount`, `discount_type`, `discount_total`, `discount_on_subtotal`, `discount_on_tax`, `gst_before_discount`, `discount_includes_tax` | The **decomposition** of a discount is stored, not just the input, so the printed document can show the split. |
| `rounding`, `unrounded_total` | Both sides of the "round total" setting are kept. |
| `event_id` | The booking→invoice link is a FK — our `sourceDocumentId`. |
| `job_card_number` | Carried across the chain, as we do. |
| `split_from_invoice_id`, `split_from_invoice_number`, `was_split`, `split_to_invoice_id` | **Invoices can be split** — part to insurance, part to the customer. A real workshop need we have not modelled. |
| `is_rework`, `rework_for_id`, `rework_for_display_id`, `rework_complaint`, `rework_reason` | **Comebacks are first-class**, linked to the original job with a complaint and a reason. Quality tracking, and the basis for not charging twice. |
| `total_labour_hours_worked`, `total_labour_hours_charged` | Worked vs charged — the technician efficiency metric, rolled up onto the invoice. |
| `signature_link`, `signature_timestamp` | Customer sign-off on the job. |
| `quote_id`, `quote_accepted_on`, `quote_first_sent_on`, `send_follow_ups_email`, `last_followup_sent_on_email`, `send_follow_ups_sms`, `last_followup_sent_on_sms` | Quote follow-up state lives **on the document**, driving the automated chase. |
| `email_sent`, `sms_sent`, `requested_customer_payment` | Communication state on the document — this is the "Contacted" flag. |
| `new_wof_renewal_date`, `new_plate_renewal_date`, `next_service_hours` | New compliance dates are captured on the invoice, then written back to the vehicle on process. |
| `hide_cost_field` | Cost visibility is **per invoice**, not only per role. |
| `stock_variance_performed` | Whether processing has already moved stock — an idempotency guard. |
| `deposits_total`, `applied_credit_amount` | Deposits and credits summed onto the header. |
| `loan_car_id`, `inspection_id`, `assigned_service_adviser_id` | Loan car, inspection and advisor all FK'd from the invoice. |
| `work_in_progress`, `labor_invoice`, `voided`, `refunded`, `auto_pay_cash`, `tax_free` | Boolean flags where an enum would serve better. |

Reminder state is stored **on the vehicle**, not in a queue: `service_reminder_sent`, `plate_renewal_reminder_sent`, `warrant_of_fitness_reminder_sent`. Simple and effective — one flag per reminder type, cleared when the due date moves.

---

## 5. Security and privacy observations

- `customers.vv_garage_password` — a third-party password stored on the customer row. Whatever the encryption at rest, a plaintext-named password column on a customer record is a pattern to avoid.
- 16 accounting-sync columns per record mean partner identifiers are spread across every core table rather than isolated.
- The API accepts path-embedded `*` wildcards for filters; combined with SSE list streaming, authorisation must be enforced per row on the server. We should assume nothing about that and keep our own row-level scoping.

---

## 6. Changes to our schema

| # | Change | Reason |
|:--|:--|:--|
| 1 | Add `CLOSED` to `DocumentState` | Open → Processed → **Closed** (settled) is the state receivables queries need |
| 2 | **Snapshot `pricesIncludeTax` and the tax rate onto the document** | A later VAT change must not alter posted invoices. Our lines keep `vatRate`; the header does not keep `pricesIncludeTax` — a live correctness bug |
| 3 | Store the **discount decomposition** (`discountOnSubtotal`, `discountOnTax`, `vatBeforeDiscount`) | Our `calculateTotals` computes it; storing it lets the printed document show the split and keeps history stable |
| 4 | Add `rounding` + `unroundedTotal` | Needed for the "round total" setting |
| 5 | Add an **`external_refs` table** instead of per-integration columns | Their 148-column invoice is the direct result of not doing this |
| 6 | Vehicle: core columns + **typed JSON extras per vehicle group** | Avoids the marine/trailer/multi-engine column sprawl while still serving those verticals |
| 7 | Add **rework** fields (`isRework`, `reworkForId`, `reworkComplaint`, `reworkReason`) | Comebacks are a real workshop concept and cheap to model now |
| 8 | Add **invoice split** links | Insurance/customer splits; model as `splitFromId` / `splitToId` |
| 9 | Roll up `totalLabourHoursWorked` / `Charged` onto the document | The efficiency metric, and it needs the per-line time entries anyway |
| 10 | Communication state on the document (`emailSentAt`, `smsSentAt`, quote follow-up timestamps) | Drives automated follow-ups; our `contactedAt` is the seed of this |
| 11 | Reminder-sent flags **on the vehicle** | Simplest correct way to avoid duplicate reminders |
| 12 | `hideCostField` per document | Cost visibility is sometimes per job, not only per role |
| 13 | `stockMovementApplied` guard on process | Idempotency when we add stock in R2 |
| 14 | Keep contacts, balances and allocations **normalised** | Their inline `contact1_*`/`contact2_*` and stored `balance` are what we are deliberately not copying — though a *cached* balance column, recomputed on write, is worth having for list performance |

---

## 7. Test records left in the account

Labelled `ZZTEST` so they are easy to find and remove:

| Record | Id |
|:--|:--|
| Customer `ZZTEST Probe Customer` | `c5207246-ab8b-11f1-83ef-3b5ef0f2ba70` |
| Vehicle `ZZTEST001` (Toyota Hilux) | `3d1a03fc-ab8c-11f1-9e3c-8bbb28b77ca4` |
| Invoice (draft, Open, zero value) | `882f83e4-ab8c-11f1-bfc5-cfc3abe8b2d2` |

Delete order: invoice → vehicle → customer. The customer screen's `Delete` button removes it; the vehicle has `Delete` and `Archive`.

---

## 8. Customer Portal — how it actually works

*(Probed 8 September 2026 after the account owner activated the module. A test inspection was created on the `ZZTEST` vehicle; nothing was sent to any customer.)*

### Activation
`Settings → CRM Tools → Customer Portal` is a bare on/off switch — `Customer Portal Support Active`, with `Cancel` and `Deactivate`. **There is no configuration at all**: no branding, no URL, no permissions, no choice of what to expose. It is a licence flag, not a settings screen.

### It is a separate application
There is no portal route among the 134 states in the admin app, and the only hosts appearing anywhere in the admin JS bundles are `my.workshopsoftware.com` and `api.workshopsoftware.com`. The portal is a distinct front end that the customer reaches by a link sent to them; the workshop never navigates to it.

### The customer-facing state lives on the inspection
The `inspections` record is small and clean — **30 columns**, in stark contrast to the 148-column invoice:

```
id · customer_id · vehicle_id · template_id · inspection_number · inspection_date
inspection_status · description · service_adviser_id
contact_name · contact_number · contact_email · customer_email
customer_comments · customer_viewed · email_sent · sms_sent
comment1 · comment2 · comment1_label · comment2_label
event_id · invoice_id · invoice_job_card_number
template_name · template_description · service_adviser_display_name
vv_garage_appointment_id · partstech_session_id
inspection_items_attributes
```

The four fields that make the portal work:

| Field | Purpose |
|:--|:--|
| `customer_viewed` | **Read receipt** — the workshop can see the customer opened it |
| `customer_comments` | The customer **writes back** from the portal |
| `email_sent`, `sms_sent` | Delivery flags per channel |
| `contact_*` + `customer_email` | Who the link goes to, separately from the account holder |

### Approval is per item, not per inspection
`inspection_items` — 26 columns:

```
id · inspection_id · template_item_id · inspection_group · ordering · group_ordering
description · inspection_type · input1 · input2 · input3 · input4 · comment
needs_attention_urgent · needs_attention_soon
estimated_time · estimated_time_red · estimated_time_yellow
estimated_cost · estimated_product_cost · estimated_product_price
approved_on · approved_by · invoice_id · event_id · _destroy
```

- **`approved_on` / `approved_by` sit on the ITEM.** The customer ticks individual findings, not the whole report. This is the single most important design fact about their inspection module.
- **RAG is two booleans, not an enum** — `needs_attention_urgent` (red) and `needs_attention_soon` (yellow); green is neither. Cheap to query, and it survives a third colour being added.
- **`input1`–`input4`** are four generic slots on every item, so one INPUT-type item can capture four readings — brake pad depths across four wheels, tyre tread across four corners.
- **`estimated_time_red` vs `estimated_time_yellow`** — a different repair estimate depending on how bad it is.
- **`invoice_id` on the item** — once approved, the item records which invoice it turned into. That is the audit trail from "customer approved this" to "we charged for it".
- A separate **`inspection_item_products`** endpoint (`/inspection_item_products/{inspection_id}/0/*/item_code/asc`) resolves each item's bound product. The template's Product Code is therefore a real join, and it is what converts an approval into billable lines.

### Items are snapshotted from the template
Selecting the `SERVICE` template instantiated **all 44 items immediately**, each carrying `template_item_id` back to its origin. Editing a template later cannot rewrite a historical inspection. We should do the same.

### The backend is Ruby on Rails
`inspection_items_attributes` and the `_destroy: "0"` marker are `accepts_nested_attributes_for` — so nested children are submitted inside the parent payload, which matches the observed behaviour of invoice lines saving with the document rather than individually.

### Inspection lifecycle, as wired
`D` Draft → `RA` Requested Approval → `A` Approved / `R` Refused → `F` Finalized. On a saved draft the buttons are `Cancel · Delete · Finalise · Save`.

### What this means for our R2 inspection module

| # | Requirement | Note |
|:--|:--|:--|
| 1 | **Per-item approval** with `approvedAt` / `approvedBy` | Not per-inspection. Everything else follows from this |
| 2 | Item → product binding as a **join**, plus `documentId` on the item once billed | The upsell path, and its audit trail |
| 3 | **Snapshot template items** onto the inspection at creation, keeping `templateItemId` | Template edits must not rewrite history |
| 4 | Two booleans for RAG (`needsAttentionUrgent`, `needsAttentionSoon`) | Simpler and more extensible than a 3-value enum |
| 5 | Four generic input slots per item | Four wheels, four corners — a real workshop shape |
| 6 | Separate repair estimates for urgent vs soon | Drives the quote the customer sees |
| 7 | `customerViewedAt` and `customerComments` on the inspection | Read receipt and reply — both are what make the portal feel alive |
| 8 | Contact fields **separate from the account holder** | The person approving is often not the account holder — fleet especially |

And one thing to do **better**: their portal has no configuration whatsoever. Ours should at minimum carry branding, a choice of what the portal exposes (invoices, inspections, bookings, next service), and per-tenant activation — this is a cheap place to be visibly ahead.

---

## 9. The money path, observed end to end

*(8 September 2026. A priced invoice was created, processed, and settled by two part-payments in the live trial account. Every figure below was read back from the API, not inferred.)*

### The test
Invoice on `ZZTEST Probe Customer` / vehicle `ZZTEST001`, two lines:

| Line | Product | Qty | Unit price | Unit cost | Hours |
|:--|:--|--:|--:|--:|--:|
| 1 | `LAB` (labour) | 2 | 650.00 | 0.00 | 2 |
| 2 | `NPN03` (stock) | 1 | 890.00 | 545.00 | 0 |

Subtotal **2,190.00** · tax **328.50** · total **2,518.50** · cost **545.00**. This tenant is tax-**exclusive** at 15 %.

### What `Save` does on a draft
Totals are computed and **stored on the draft**, before any posting:

```
subtotal 2190.00 · gst 328.50 · total 2518.50 · balance_due 2518.50 · cost 545.00
tax_rate 15.0 · invoice_number null · job_card_number 50000 · invoice_status "O"
```

Two things matter here. `balance_due` and the rolled-up `cost` exist on an unposted draft — so their receivables and profit queries never join to lines. And **`tax_rate` is stamped on the invoice**, which is the snapshot behaviour our schema is missing.

Server-side validation is real: a line carrying a stale `product_id` was rejected with *"Product with id no longer exists."*

### What `Process` does
It is **not** a single button. The sequence is:

1. **`Process`** opens a modal, *"Update Renewal Dates"* — Rego Due Date, Odometer (pre-filled from the vehicle), Hours.
2. Saving that modal fires `PATCH /invoice/update_vehicle_details_on_process_invoice` — a **dedicated endpoint**, separate from the invoice save.
3. A second confirm: *"Are you sure you want to save and process this invoice?"* → No / Yes.

The vehicle write is therefore a **prompted, confirmed step**, not a silent side effect. Ours writes silently; theirs is better and we should copy it.

The exact diff on the invoice:

| Field | Before | After |
|:--|:--|:--|
| `invoice_number` | `null` | **50000** |
| `invoice_status` | `O` | **`P`** |
| `job_status` | `B` | **`F`** (Finalised) |
| `description` | `""` | *"Diagnostic and brake inspection labour"* |
| `odometer` | 0 | 124500 |

Four behaviours worth naming:

- **The invoice number equals the job card number** (both 50000). The *Invoice Number Equals Job Number* company setting is on by default, and the number comes from the job sequence.
- **Processing an invoice finalises the job** — `job_status` jumps straight to `F`, skipping the intervening statuses.
- **`description` is auto-filled from the first line**, giving every list a human-readable summary for free. A small, cheap, genuinely good idea.
- `balance_due` did **not** change — it was already correct on the draft.

Elsewhere:

- **Vehicle**: `odometer` 124500, `last_in_date` set. `last_service` and `next_service` stayed **null** — they are taken from the invoice's Next Service fields, which were blank, not derived.
- **Customer**: `balance` written to **2518.50**. The denormalised balance is maintained at post time.
- **Stock**: `NPN03.quantity_on_hand` went from `null` to **−1.0**. Processing decrements stock for `product_type: 'S'` lines, and **negative stock is allowed** — no block, no warning.

### Payments

A payment is a **document with the same Save / Process lifecycle**, and it has *two* child collections:

```
customer_payment
├── customer_payment_items_attributes    → allocations to invoices
└── customer_payment_methods_attributes  → tender lines
```

The header is only **14 columns**:

```
id · customer_id · amount · applied_amount · reference · post_date · note
customer_payment_number · status
stripe_status · payment_processing_id · tillpayments_terminal_payment_intent_id
customer_payment_items_attributes · customer_payment_methods_attributes
```

**Allocation** (`customer_payment_items`): `invoice_id`, `amount`, plus `invoice_number`, `invoice_total`, `invoice_post_date`, `invoice_balance_due` denormalised for display.

**Tender** (`customer_payment_methods`): `payment_type`, `amount`, `reference`, `use_eftpos`.

Five design facts we did not have:

1. **A payment carries many tender lines** — split payment across cash, card and EFT on one receipt. Our model has a single `methodId` and cannot express this.
2. **The reference belongs to the tender line, not the payment.** The EFT reference is per method, so a split payment carries one reference per tender. Ours puts it on the header.
3. **`payment_type` is a plain string** ("Direct Deposit"), not a foreign key to the payment-methods list.
4. **`amount` and `applied_amount` are separate.** Money taken but not allocated is unapplied credit — this is the mechanism behind *Unapplied Credit* in the customer header.
5. **Allocations must balance against tenders.** The screen shows a running `Applied Total` and a `Balance`, and `Balance` must reach zero before Process.

The flow: 🔍 opens *"Please Select an Invoice"* (with an **All** button for bulk) → selecting **auto-applies the full outstanding balance** and pre-fills the tender amount → editing the applied amount **recomputes the row's remaining balance and re-syncs the tender** → `Apply` records the tender line → `Process` posts, behind the same *"Are you sure"* confirm.

Payment numbers come from **their own sequence starting at 30000**, and a processed payment's `status` is **`C`** — the payment vocabulary differs from the invoice's.

### Settlement, verified

| After | `invoice_status` | `balance_due` | customer `balance` |
|:--|:--|--:|--:|
| Process | `P` | 2518.50 | 2518.50 |
| Part payment 1,500.00 (Direct Deposit, ref `EFT-ZZTEST-001`) | **`P`** | **1018.50** | **1018.50** |
| Part payment 1,018.50 (Direct Deposit, ref `EFT-ZZTEST-002`) | **`C`** | **0.00** | **0.00** |

So `C` means *fully settled*, set automatically when `balance_due` reaches zero. A partial payment leaves the invoice at `P`. The invoice picker on a later payment shows the **remaining** balance, not the original total. `job_status` stayed `F` throughout — payment does not touch the job.

### Incidental
Reports are rendered by **JasperReports**: `GET /reports/jasper_mechanic_times_log/{invoice_id}`. Invoice actions are Print → Invoice, Email → Invoice, and a secondary menu carrying Send SMS.

### Consequences for our build

| # | Change | Why |
|:--|:--|:--|
| 1 | **Payment gets tender lines** — a `PaymentTender` child, with `reference` per tender | Split payment is normal at a workshop counter; our single-method model cannot represent it |
| 2 | **Separate `amount` from `allocated`** on the payment | Unapplied credit falls out of the difference |
| 3 | **Enforce allocations = tenders before posting** | Their `Balance` must be zero to Process; ours needs the same invariant |
| 4 | **Derive `CLOSED` when the balance reaches zero**, keep `PROCESSED` while partly paid | Verified transition |
| 5 | **Prompt for odometer / renewal dates at process time** rather than writing silently | Their confirmed modal is better UX and produces better data |
| 6 | **Auto-fill the document description from line 1** | Free readability in every list |
| 7 | **Decide our negative-stock policy deliberately** | They allow it silently; we should at least warn |
| 8 | **Snapshot the tax rate onto the document** | Confirmed they do; ours does not |
| 9 | Invoice-picker with **auto-apply full balance** and an **All** button | The interaction that makes allocation fast |

### Still not verified
- **The customer portal's customer-facing side.** Activation is a licence flag; the workshop-side fields (`customer_viewed`, `customer_comments`, per-item `approved_by`) are known, but the portal is a separate application reached only by a link inside a sent email. Seeing it requires sending mail, which was out of scope for this probe.
- Inspection → invoice conversion (needs a finalised inspection with approved items).
- Credit notes, refunds and `apply_credit`.
- Supplier invoices and purchase orders — the whole payables side.
- Stock take, price matrix internals, bundles.
- Report output, BI dashboards, statements.
- The mobile app.
- Booking-diary drag-and-drop and public booking request approval.
- Multi-tax combination, and rounding behaviour when enabled.

### Test data left in the account
`ZZTEST Probe Customer` · vehicle `ZZTEST001` · invoice **50000** (closed) · payments **30000** and **30001** · one draft inspection. Delete in that reverse order if you want the account clean; the invoice cannot be deleted while payments are allocated to it.
