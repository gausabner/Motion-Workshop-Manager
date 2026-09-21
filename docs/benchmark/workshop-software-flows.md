# Benchmark: Workshop Software — screen-by-screen flows

> **Captured:** 8 September 2026, from the live app at `my.workshopsoftware.com` (account **MEGA AutoWorks**, Windhoek, Namibia, day 16 of a 30-day trial), walked read-only. Nothing was created, saved or processed.
> **Companion documents:** [feature inventory](workshop-software-feature-inventory.md) (what the product does) · [PRD](../../PRD.md) (what we will build).
> **Why this exists:** the feature inventory lists capabilities. This document records *how the screens behave* — the flows, lifecycles and patterns we are choosing to copy or reject.

---

## 0. Stack and state of the product

The app is **AngularJS 1.x** with a partially completed migration to **Angular 2+**. Both render on the same page: the body carries `ng-model` / `ng-scope` (AngularJS), while the header is Angular components (`wor-icon`, `wor-global-search`, `wor-customer-messages-notifications`) inside a `ui-redesign` container. Routing is UI-Router with **134 registered states**. Record ids are v1 UUIDs.

The redesign is visible in the information architecture too — see §1. Two implications for us:

1. Their newest work is component-based and customer-facing. They are not going to out-build us on *core workshop flow* in the near term; their effort is going into the rewrite and into CRM.
2. Anything we copy from the *old* screens is copying a 2010-era AngularJS interaction model. Copy the **flow**, not the widget.

---

## 1. Information architecture (as at Sep 2026, post-redesign)

The February capture had a different structure. The current one:

**Top bar** (icon-only since the redesign): Dashboard · Booking Diary · Transaction Centre · global search · 💬 customer messages · ⚡ Quickstart · 🕒 clock-on · profile.

The ⚡ **Quickstart is still there**, unchanged from February — *Customer Booking · Customer Invoice · Customer Payment · Inspection · Supplier Stock Order · Supplier Invoice · Supplier Payment*. It renders only at wider window widths, which is why an earlier pass of this document wrongly recorded it as removed. Creation is therefore available **both** globally from the Quickstart and contextually from a `+` in each page header and accordion section.

**Sidebar**

| Group | Items |
|:--|:--|
| *(top level)* | Customers · Vehicles · Suppliers · Products *(→ Stock Take)* · Loan Car Diary *(→ Loan Vehicles)* · Analytics *(→ Business Reports, Statements)* |
| **CRM Tools** *(new)* | WorkshopWeb · Public Booking · Communication Centre · Inspections · Reminders · Customer Portal · Video Settings |
| **Integrations** | Automotive · Accounting · Marketing · POS |
| **Admin** | Mechanics · Service Advisors · Users · Schedule |
| **Settings** | Company Settings · Company Lists · Price Matrix · Messages |
| **Actions** | Send Reminders · QuickBooks Export · Export · Import |

**What the redesign changed, and why it matters to us:** everything that *talks to the customer* was pulled out of Settings into **CRM Tools**; Settings shrank to four pure-configuration screens; Schedule moved to Admin. This is a better split than the single Settings hub proposed in our PRD §5, and we should adopt it.

---

## 2. The three patterns that cover the whole app

### 2.1 The list screen
Title bar: icon · title · **Archived** toggle · **Filter** box · `+`.
Grid: 3–6 sortable columns, page-size select (10/20/50/100), `First ← n → Last`, and a row of **icon actions** at the right of every row.
Customers row actions, left to right: **edit · vehicles · booking · invoice · SMS · email**. *(Ours matches this exactly.)*

### 2.2 The record screen
A details form, then **collapsible accordion sections of related records, each with its own `+`**. On a customer: Vehicles · Customer Invoices · Customer Payments · Customer Quotes · Customer Bookings · Customer Inspections · Activity Log.
Header carries live financial context — **Unapplied Credit** and **Account Balance**.
Footer action bar: `Cancel · Delete · Archive · Save`.
Small touch worth stealing: inline action buttons *inside* the input — an SMS bubble in the Mobile field, an envelope in the Email field.

### 2.3 Draft → Process
**Every transactional screen in the app has the same two-stage lifecycle**: `Save` keeps a draft, `Process` posts it and locks it, `Void` reverses it. This is true of invoices, bookings, quotes, credits, customer payments, supplier invoices, supplier payments **and stock takes** (`Cancel · Save Draft · Process`). A green `● Open` badge sits in the panel header until it is processed.

> **Decision:** adopt this universally. We already do it for documents; payments and stock takes must follow the same rule rather than being simple forms.

---

## 3. Dashboard

Two tabs, **Sales** and **Inspections**, with two global toggles that re-cast every figure on the page — **TAX INCLUDED** and **MONTH TO DATE** — plus a ★ to pin the view.

Nine KPI tiles: Today's Sales · Past Week's Sales · Past Month's Sales · Open Jobs · Open Bookings · **Unassigned Bookings** · Open Orders · *(Month)* Service Reminders · *(Month)* Renewals.

**Recent Activity** panel, tabbed: Transactions · Jobs In Progress · Recently Completed.

**Analysis** panel: a **Sales / Cost / Profit line chart by day**, with the same figures as a table beneath it, navigated `Previous Week` / `Next Week`. Profit is a first-class dashboard number, which is only possible because unit cost rides on every document line.

Plus a vendor **Newsfeed** (their blog) and a trial/subscription banner.

---

## 4. Booking Diary

- A banner above the calendar: *"There are currently N booking requests pending approval."* Public bookings land in an **approval queue** (`/bookings/requests`), they do not go straight into the diary.
- Views: `month · week · day · Today · ‹ ›`, plus a **Calendar / List** toggle.
- **Day view is one column per mechanic**, in 30-minute slots starting at the shop-open time.
- The diary shows a **window of three mechanics at a time**, paged with `‹ Mechanic 1 – Mechanic 3 ›`. URL state: `?view=day&group_index=0&date=2026-09-08`.
- Capacity comes from Company Settings (shop opens/closes, work hours per day) and the **Schedule** screen (see §9.4).

---

## 5. Transaction Centre

Tabs: **Bookings · Inspections · Jobs · Orders · Supplier Invoices**. *(Inspections is new since February.)*

Crucially it is **date-windowed, not paginated**: `Start Date` / `End Date` with `Month | Week | Today` presets. A `Filter` box and a `+` (Create New) sit in the title bar. `+` opens a new **booking** at `#/event`.

> **Difference from ours:** we built tabs + search + paging. Theirs is tabs + date window. For a workshop, "what is happening this week" is the real question — we should add the date window and keep search.

---

## 6. The transaction document

One record whose *type* and *status* change. Routes make the shape explicit:

```
#/event                                            new booking
#/{customer_id}/{vehicle_id}/invoice/{id}          invoice / quote / credit
#/{invoice_id}/{invoice_item_id}/labor_items       mechanic times, per LINE
#/invoice/{invoice_id}/add_invoice_notes           notes in a separate window
#/{customer_id}/customer_payment/{id}?invoice_id   payment
#/{customer_id}/apply_credit/{id}                  apply credits
```

### Screen layout
1. **`Select A Customer`** — a *panel* with a search box and a `+` to create a customer inline. Not a dropdown.
2. **`Select A Vehicle (Optional)`** — a second panel beside it, with its own filter and `+`, listing that customer's vehicles.
3. **Document panel** with a `● Open` state badge and a ★.
4. Header fields — booking: Reference, Customer Order Number, Booking Date, Due By, Description. Invoice adds: Invoice No., Job Card No., Post Date, Invoice Type *(Invoice / Credit / Quote)*, Account Type, Follow Up Date, **Odometer, Hours, Next Service – Kilometers, Next Service – Hours**, Job Status, Job Status Comment, Internal Invoice, Payment Terms, Customer Source.
5. **Line grid.** A **default labour line is pre-seeded** on every new document (the "Default Labour Product" setting). Each row: trash icon · Product · Description · Unit Price · Qty · Sales Tax · Line Total. The invoice grid adds **Unit Cost** and **Hours**. Add-line is a **split button `+ ▾`**. The grid has **per-column visibility toggles, its own filter box and its own paging** — this is what the "Show Cost Field / Hide Cost Field" action drives.
6. **Totals block, bottom right**: Subtotal · **Freight (inline editable)** · Sales Tax · **Total**. Discount has an **amount / percent type toggle**.
7. **Notes** — rich text (Quill), one box per audience (Event / Job Card / Invoice), each with **`+ Add Template`** and "Edit Notes in New Window".
8. Action bar: `Cancel · Start Job · Save` on a booking; `Cancel · Process · Save · Void` on an invoice.

**Column sets differ by document type** — a booking has no cost column, an invoice does.

**Mechanic time is per line**, not per job: `labor_items` hang off an invoice *item*. The Hours column on the invoice grid is the roll-up.

---

## 7. Customer Payment  *(our next slice)*

Route `#/{customer_id}/customer_payment/{id}?invoice_id=…`

```
Customer: <name>            ← collapsed, read-only summary panel
                              (Customer Information · Customer Contact · Contact 1)

Customer Payment                                          ● Open   ★
  Post Date          Reference

  ┌ Reference │ Post Date │ Balance Due │ Applied Amount │ Balance ┐
  │ 🗑  one row per open invoice                                    │
  │ 🔍  [NOT MOTO toggle]                                           │
  └──────────────────────── Applied Total  ·  Balance ─────────────┘

  Payment Method ▾ | Reference | Amount $ | [ Apply ]

  Notes

  Cancel · Process · Save
```

Behaviour to copy:
- The payment **allocates across many invoices** in a grid; each row shows Balance Due, the Applied Amount you are putting against it, and the remaining Balance.
- **`Apply`** takes the entered amount and distributes it across the selected invoices — you do not type each allocation by hand.
- A payment is a **document**: `Save` = draft, `Process` = posted.
- Payment Method + Reference (the EFT reference) + Amount.
- `Apply Credits` is a **separate screen** (`/apply_credit/`), not part of the payment screen.

---

## 8. Inspections

Three levels, and the commercial mechanism sits in the third.

**Groups** (`/inspection/groups`) — the *sections* of a checklist. Defaults: `EXTR` Exterior · `INTR` Interior · `STAND` Standard · `TYRES` · `UNDBDY` Underbody · `UNDBON` Under Bonnet.

**Templates** (`/inspection/templates`) — the checklists. Defaults: `SERVICE` "Service Checksheet" · `VISUAL CHECK` "Complimentary Reliability & Safety Visual Checks".

**Template builder** (`/inspection/template/{id}`):
- Template header: Name, Description, **Comment Label 1**, **Comment Label 2** (the comment column headings are renameable per template).
- Sections are added by picking a Group, each with an **Order**, collapsible.
- Items within a section, each with **Order**, **Type**, **Description**, **Product Code** (a product search), **Comments**, and a red `−` to remove.
- **Item types seen:**
  - `Input` — free entry (e.g. *"Time/K's since last service"*)
  - `Green/Yellow/Red` — RAG condition; adds an **Estimated Repair Time** field
  - `Carry Out` — a task to perform and tick
- The `SERVICE` template ships with **44 items** in the Standard group alone.

> **The key mechanism:** each item carries a **Product Code**. When the customer approves a red item, that product and its labour flow onto the job card. The inspection is the upsell engine, and the product link is what makes it one. An inspection module without item→product binding is just a checklist.

Instances live at `#/{customer_id}/{vehicle_id}/inspection/{id}` — same customer+vehicle addressing as invoices.

---

## 9. Admin

### 9.1 Mechanics / Service Advisors / Users
Standard list screens. Users carry a **Group**, a status (Active / Inactive / Blocked), Dashboard Privileges, Business Intelligence access, 2FA and Azure SSO. **Mobile users** are a separate, cheaper record type with `Show Mechanic Features`, `Limit Customer Information`, `Advanced User`.

### 9.2 Group Rights  (`/group-rights`, `/group-rights/{group}`)
Eight groups: `ADMIN · INVOICE + CUST PAY · INVOICE ONLY · MANAGER · MECHANIC · OWNER · PAY ONLY · USER`.

Rights are **one on/off toggle per entity**, 28 entities:

> Companies · Customer Payment Items · Customer Payments · Customers · Invoice Items · Invoices · Labor Items · Mechanics · Products · Purchase Order Items · Purchase Orders · Reports · Searches · Loan Car Schedules · Users · Vehicles · Vendor Invoice Items · Vendor Invoices · Vendor Payment Items · Vendor Payments · Vendors · SMS · Event Logs · Price Matrices · Tax Groups · Schedules · Price Matrix Items · Unavailable Times

Buttons: `Cancel · Delete · None · Save`.

> **Difference from ours:** theirs is **entity-based** (can this group touch Invoices at all?); ours is **action-based** (`documents:process`, `documents:void`, `documents:see_cost`). Ours distinguishes the cases that actually matter in a workshop — an advisor who may invoice but not void, a mechanic who may not see cost. **Keep ours**, but note the entities they gate that we have no concept of: *Searches*, *Event Logs*, *Unavailable Times*.

### 9.3 Mechanics Clock On (`/mechanics_clock_on`)
The floor-level clock-in screen, reachable from the top bar.

### 9.4 Schedule (`/schedule`)
Mechanic × day-of-week grid of working hours (default `7:00 – 5:00`, Mon–Fri), `Prev Week` / `Next Week`, and a **Hide Defaults** toggle so you only see exceptions. Same three-mechanic windowing as the diary. This is what feeds diary capacity.

---

## 10. Settings

**Company Settings** — ~60 fields in nine groups: Company · Product · Vehicle · Booking · Tax · Invoice · Next Invoice/Payment Number · **Variable Labels** · Dealer Access. (Fully enumerated in the feature inventory §WS-SET.) Variable Labels let a tenant rename *Vehicle*, *Plate Number*, *VIN*, *Fleet Code*, *Employee*, *Member Number* — how one product serves car workshops, marine, plant and machinery.

**Company Lists** — invoice note templates · job card note templates · document templates · email templates · unit-for-sale templates · SMS templates · customer sources · payment methods · product categories · product groups (each with a sales and purchase GL account).

**Price Matrix** — named matrices ("Select A Matrix") of markup bands.

**Messages** — the default body text for every outbound document and message: invoice/job card/statement/quote/cash-invoice footers; invoice, supplier-invoice, statement, supplier, customer and inspection email texts; invoice SMS (160 chars), email + SMS booking confirmations, loan-car T&Cs, bulk SMS default, and WorkshopPay request email/SMS.

---

## 11. CRM Tools

**Communication Centre** — bulk outbound with **audience segmentation**: by Postcode · by Vehicle Details · by Customer Source · by Last In Date · or a customer list. Then `Email All` / `SMS All` / `Print All` / **`Use Preferred Contact Method`**. Three message bodies (SMS, Email subject+body, printed Document), each with `+ Add Template`.

Merge placeholders, verbatim:
```
%custfullname%   %custfirstname%  %custlastname%   %custcompanyname%
%custaddress1%   %custaddress2%   %custsuburb%     %custstate%   %custpostcode%
%companyname%    %compaddress1%   %compaddress2%   %compsuburb%  %compstate%  %comppostcode%
```

**Reminders** — automated service reminders, licence/rego renewal, WOF renewal, booking reminders, quote follow-ups; each with a days-before/after setting and its own email + SMS body.

**Public Booking** — public URL, appointment types (description + estimated hours), schedule hours, "diary full at %", logo, navbar and header colours.

**Customer Portal** — **must be activated per tenant** (`Customer Portal Not Activated · Inactive · [Activate Customer Portal]`). Several modules follow this activation pattern.

**WorkshopWeb** — hosted website builder (Platinum). **Video Settings** — video capture on inspections.

---

## 12. Analytics

**Business Reports** — seven groups, unchanged since February: Sales · Stock · Workshop · Mechanic · Customer · Supplier · Log. Each report is a parameter form (date range, order by, search by, ranges, type limits, summary toggles) producing `Print PDF` / `Download CSV`.

**Statements** — `Send To Customer As` (EMAIL ONLY / PRINT ONLY / PRINT ALL / EMAIL and PRINT), Begin/End Date, `Show Paid Transactions`, **`30/60/90 Statement`**.

---

## 13. Products, stock and purchasing

**Products** list → product record with tabs: Product Invoices · Stock Orders · Purchase History · Stock Take Log · Serial Numbers.

**Stock Take** (`/stock_take`) — filter by Product Type, Group, Supplier, Location, Begin/End Item, `Hide Zero Stock`; grid of Item Code · Description · Group · Supplier · Location · **On Hand** · **Count**; then `Cancel · Save Draft · Process`.

**Purchasing** — `#/{vendor_id}/purchase_order/{id}/{acquisition_order_id}` · `vendor_invoice` · `vendor_payment` · `apply_vendor_credit` · `branch_vendor_payment`. Supplier payments mirror customer payments exactly.

---

## 14. Loan cars, units, multi-site

**Loan Car Diary** (`/loanCar/{customer_id}`) — same calendar component as the booking diary, windowed over loan vehicles instead of mechanics. **Loan Vehicles** is the register. Activation flow at `/loan_car/activate`.

**Units** (`/units`, `/unit/{id}`) — vehicle *sales* stock (DealershipSoft). Related: `dealership.sale`, `dealership.templates`, `dealership.advertising-settings`, `manage_advertisement`.

**Multi-site** (Platinum) — `branches` (+ dashboard, settings, contacts, **stock-transfer**), `companies`, `franchise`, `franchise-settings`, `franchise-owner-settings`, `admin_dashboard`, `admin_reports`.

---

## 15. Actions

`Send Reminders` (batch run) · `QuickBooks Export` · `Export` · `Import`.

**Import** covers: Customers · Vehicles · Suppliers · Products · Vehicle History · Vehicle History Items/Lines · Bundle Parent Product · Bundle Items · Serial Numbers. Flow is: choose CSV → "First Row Contains Column Names?" → map columns → **Analyse** → review → **Import Now**.

> This is the switching path. A workshop leaving Workshop Software for us needs the same importers, matched to *their* export format.

---

## 16. Integrations

Automotive: Vehicle Visuals, vvGarage, Carfax, DVLA lookup, WorkshopData, Haynes Pro, Mitchell1, TireMetrix, Repco, Burson, Ashdown, PROLink, Oscar, Partstech, TireConnect, hsy, Parts Authority, GSF.
Accounting: QuickBooks Online, Xero, MYOB. Marketing: MailChimp, Podium. POS.
Payments: Assembly Payments, Stripe, Celero, TillPayments. Also: AMS Rewards, Capricorn, UK Postcode, API settings, WS API settings.

**None of the parts or vehicle-data integrations serve Namibia or South Africa.**

---

## 17. What we are changing in our build as a result

| # | Change | Why | Size |
|:--|:--|:--|:--|
| 1 | Replace the customer/vehicle `<select>` with **searchable panels + inline create** | Ours breaks past ~200 customers. Blocks everything downstream | ~1 day |
| 2 | Payments as a **document** (`Save`/`Process`) with an **allocation grid and `Apply`** | Confirmed by their screen; our model already supports it | in slice |
| 3 | Adopt **CRM Tools vs Settings** split in our IA, and keep a global quick-create **as well as** contextual `+` | Their redesign is right; our single Settings hub is not | small |
| 4 | Add the **date window** (Month/Week/Today) to the Transaction Centre | "What's on this week" is the real question | small |
| 5 | **Hours column** on invoice lines + per-line time entries | Mechanic time is per line, not per job | medium |
| 6 | **Product Code on inspection items** | Without it the inspection module has no commercial point | in R2 |
| 7 | **Default labour line** pre-seeded on new documents | Setting already modelled | trivial |
| 8 | **Freight inline in the totals block**; discount amount/percent toggle | Matches how it is actually used | trivial |
| 9 | Per-type **column sets** and column visibility | Drives "show/hide cost" by permission | medium |
| 10 | Customer record as an **accordion of related sections with `+`** | Better than our single vehicles table | small |
| 11 | **Account Balance + Unapplied Credit** in the customer header | Falls out of the payments slice | small |
| 12 | **Stock takes as draft→process** | Consistent lifecycle | R2 |
| 13 | Keep our **action-based permissions**, add gating for report and cost visibility | Ours is better suited than their entity toggles | done |
| 14 | Merge-field syntax for templates | Use `{{snake_case}}`, not their `%custfirstname%`, but cover the same fields | small |

### What we deliberately will **not** copy
- Icon-only top navigation — it costs discoverability for no gain.
- Entity-toggle permissions — action-based is a better fit.
- In-grid paging on line items — a job card with 200 lines is a data problem, not a UI one.
- "Cash Sale" as a reserved customer record — our `isCashSale` flag is cleaner, provided balance reporting excludes it explicitly.
- Every AU/NZ/UK/US integration, and WorkshopPay.
