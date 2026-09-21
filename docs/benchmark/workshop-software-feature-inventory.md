# Benchmark: Workshop Software — Feature Inventory

> **Source material:** 35 saved pages of the live app (`References/`, captured Feb 2026 from the *TipTop AutoCare* trial account, Windhoek, Namibia), 60 screenshots (`Screenshots for Reference/`), and workshopsoftware.com (features, pricing, feature pages) read on 4 Sep 2026.
> **Purpose:** the evidence base for `PRD.md` v2. Every requirement in the PRD that cites *WS-…* points at an item here.

Workshop Software (Workshop Software Pty Ltd, Warriewood NSW) has 30+ years in market, ~9,400 users, ~3,500 workshops, and sells in AU, NZ, USA, UK and **Africa (+27 87 551 0860)** — it is the incumbent MOTION will be compared against by Namibian and South African workshops.

---

## 1. Pricing tiers (USD, Sep 2026)

| Tier | Monthly / annual-equivalent | What it adds |
|:--|:--|:--|
| **Silver** | $169 / $149 | Full job & vehicle management, booking management, import/export, SMS (per-message fee), stock orders, supplier invoices & payments, stock take, canned services/bundles, VIN & plate decoding, adjustable user groups & permissions, shop scheduling, mobile app. Additional users $20/user/month. |
| **Gold** (popular) | $199 / $179 | + Advanced phone app, Business Intelligence, electronic inspections, online bookings from website |
| **Platinum** | $299 / $249 | + Multi-site, public booking API, public API, advanced service, WorkshopWeb (hosted website) |

Integrated card payments (WorkshopPay) are **only available in AU, NZ, UK and USA** — not Africa.

## 2. Information architecture (as shipped)

**Top bar:** Dashboard · Booking Diary · Transaction Centre · global search · ⚡ Quickstart (Customer Booking, Customer Invoice, Customer Payment, Inspection, Supplier Stock Order, Supplier Invoice, Supplier Payment, Stock Take Single Add) · 🕒 Mechanics Clock On · profile (User Profile, Company Profile, Logout)

**Sidebar:** Customers · Vehicles · Suppliers · Products (→ Stock Take) · Loan Car Diary (→ Loan Vehicles) · Analytics (→ Business Reports, Statements) · Integrations · Admin (→ Mechanics, Service Advisors, Users) · Settings · Actions

**Settings:** Company Settings · Public Booking · Company Lists · Inspections (Groups, Templates, Settings) · Price Matrix · Reminders · Messages · Schedule · Video Settings · Customer Portal

**Actions:** Send Reminders · Communication Centre · QuickBooks Export · Export · Import

## 3. Module-by-module inventory

### WS-DASH — Dashboard
- **Recent Activity** grid with tabs *Transactions | Jobs In Progress | Recently Completed*; columns User, Transaction, Date, **Sales, Cost, Profit**.
- Widgets with *Include Tax* and *MTD* toggles and a Start/End date filter.
- Weekly **Analysis** panel (Previous/Next Week).
- Vendor newsfeed.

### WS-DIARY — Booking Diary
- Month / week / day calendar, *Today*, *Add Event*, per-event *Event Times*.
- Diary lanes driven by *Mechanics For Booking Diary*, *Shop Opens/Closes*, *Default Work Hours Per Day*, *Booking Diary Full At %*.
- Weekly **Schedule** (staff roster with defaults, prev/next week).
- **Appointment Types** with estimated hours (feeds public booking).

### WS-TXN — Transaction Centre
- One list for *Bookings | Jobs | Orders | Supplier Invoices*.
- Filters: date, type (*Quotes, Open Invoices, WorkshopPay Outstanding, Open Credits, All*), job status.
- Columns: Date, Customer, Make, Model, Rego, Job Card, Status, **Status Comment, Contacted**, Total. *Create New*.

### WS-JOB — Job statuses (9)
`Booked In` → `Work In Progress` → `Waiting For Parts` → `Inspection In Progress` → `Waiting For User Approval` → `Job Complete` → `Customer Notified` → `Complete – Awaiting Finalise` → `Finalised`

### WS-DOC — The transaction document (Quote / Booking / Job Card / Invoice / Credit)
One document that changes type and status; not separate entities.
- **Header:** customer (or *Cash Sale*), optional vehicle, invoice no., job card no., customer order no., reference, post date, **invoice type (Invoice / Credit / Quote)**, account type, follow-up date, **odometer, hours, next service km / hours**, job status + status comment, *internal invoice*, payment terms (12 presets incl. after-EOM), customer source.
- **Lines:** product lookup, description, unit price, qty, **unit cost** (show/hide cost field), sales tax, line total, **type** (Stock / Labour / Sublet / Consumable / Accessory / Tyre), per-line discount; freight; header discount (amount or %); running totals.
- **Notes:** event notes, job card notes, invoice notes with rich text and **note templates**; "Edit notes in new window".
- **Actions:** Save, **Process** (post), **Void**, Delete, Done, *Start Job*, *Convert to Job Card*, *Copy Invoice*, *Edit Invoice*, *Rework*, *Add Discount*, *Add Deposit*, *Enter Mechanic Times*, *Create Inspection*, *Create Credit*, *Apply Credits*, *Refund Credit*, *Add To Order / Create Order* (parts to a supplier PO), *Create Loan Car*, *Use Serial Numbers*, *Add DOT/TIN* (tyres), *Get Vehicle Data*, *WorkshopData Labour Times*, *Add <supplier> Items* (Repco, Burson, Partstech, TireConnect, Parts Authority, GSF, …).
- Print/email: invoice, cash invoice (receipt), job card, quote; bulk daily job-card printing.

### WS-CUST — Customers
- List: Customer, Mobile, Phone; filter; *Active* toggle; page size 10/25/50; row actions **Edit · Vehicles · Booking · Invoice · SMS · Email**; *Add Customer*.
- Fields: first/last name, **biller** (parent account), business number, street + postal address (state list is the **13 Namibian regions**), phone, mobile, fax, email, web, preferred contact (*Email / SMS / Opts Out / Document*), hourly rate, discount %, markup %, **price type (Retail / Price 2 / 3 / 4)**, payment terms, **customer source** (configurable list), imported ID, government ID, sales-tax-free, customer-limited, AMS / Capricorn member numbers, up to **3 contacts** (name, position, phone, mobile, email), note.
- **Archive / Unarchive** rather than delete.
- Per-customer: bookings, invoices, payments, credits, statements, SMS/email history, *Change Customer* on a document, *Analysis*.

### WS-VEH — Vehicles
- List: Rego, Make, Model, Customer Name.
- ~40 fields incl. vehicle group (body type), rego, state, make, model, model code/series, VIN (17-char validation), engine no., fleet code, transmission (large list), A/C, body type, colour, seating, odometer, hours, drive type, engine code, chassis no., fuel type, **rego due, WOF due**, build/prod date, last in, last service, next service (date & km), service interval, cylinders, litres, fuel induction, tare mass, **radio pin, key code**, tyre size, imported ID, note.
- Tabs: **Attachments**, Vehicle Invoices, Imported Vehicle History (+ lines), Vehicle Bookings, Vehicle Inspections. Actions: Create Invoice / Booking / Inspection; Archive.
- VIN / plate decoding (Carfax; UK DVLA/MOT history).

### WS-SUP — Suppliers
- List: Supplier, Suburb, Phone, Website.
- Fields: company, biller, address, country, phone/mobile/fax/email/web, account number, imported ID, payment terms, Partstech store, note, 2 contacts.
- Tabs: **Supplier Stock Orders, Supplier Invoices, Supplier Payments, Activity Log**. Actions: Create Stock Order / Invoice / Payment.
- **Supplier invoice:** ref, supplier invoice no., post date, price-includes-tax, type (Invoice / Credit), terms, lines (product, description, **job card no.**, unit cost, qty, tax, total), freight, notes; *Change Sell Price*; Process / Void.
- Supplier statement + vendor balance reports.

### WS-PROD — Products & stock
- List: Item Code, Description, Brand, Retail Price, Cost, Qty.
- Fields: item code, description, description 2, searchable tags, **group, category** (configurable lists with GL accounts), supplier, brand, **type (Stock / Labour / Sublet Repairs / Consumables / Accessories / Tyres)**, qty on hand, default labour qty, sales-tax-free, don't-update-qty, service flag, **requires serial number**, price lookup, qty reserved, qty available, retail, cost ex/inc tax, price 2/3/4, imported ID, comment, job card comment.
- Tabs: Product Invoices, Stock Orders, Purchase History, **Stock Take Log, Serial Numbers**.
- **Stock Take** (full + single add), stock reorder suggestions (Suggested / On Order / Received), **bundles / canned services**, **Price Matrix**, average-vs-current cost, reserved stock, supplier price-file import.

### WS-INSP — Inspections
- **Inspection Groups** (code, description) → **Templates** → inspection instances linked to job/vehicle.
- Inspection Settings: default product, default service advisor, default contact, hide estimated cost / hours / product cost / price, **notify on approval / refusal**.
- Customer receives details, photos and costs on their phone and **approves with one click**; approved items flow to the job. Job statuses *Inspection In Progress* / *Waiting For User Approval*.
- Mobile app: photos & videos.

### WS-LOAN — Loan cars
- **Loan Vehicles** register; **Loan Car Diary**; Create / Start / Return / Review loan car from a job; loan-car T&Cs text; loan car history report.

### WS-MECH — Mechanics & time
- Mechanics list (Name, Mobile); **Mechanics Clock On**; *Enter Mechanic Times* on a job; **Mechanic Time Log**; *Mechanic Performance*, *Time Sheet*, *No Labour Times* reports.
- Service Advisors list; *Use Service Advisors* toggle; default advisor on inspections.

### WS-PAY — Payments, credits, statements
- Customer Payment (quickstart), **payment methods** list (code, integrated, EFTPOS, tax), receipts for cash invoices, **deposits / pre-payments**, credits (create, apply, refund), **Statements** (email/print, as-at, 30/60/90, include paid), customer balances & outstanding balance reports.
- WorkshopPay (card + online; AU/NZ/UK/US only).

### WS-USER — Users, roles, security
- **User groups:** ADMIN, OWNER, MANAGER, USER, MECHANIC, INVOICE ONLY, INVOICE + CUST PAY, PAY ONLY. Status Active / Inactive / Blocked.
- Flags: dashboard privileges, Business Intelligence access, **2FA**, Azure SSO.
- **Mobile users** (separate licence): *Show Mechanic Features*, *Limit Customer Information*, *Advanced User*.
- Company-level: *Enable 2FA*, *Require SSO*, *Dealer Access* (grant/revoke a code).

### WS-RPT — Analytics
**Business Reports** (all Print PDF / Download CSV, date-ranged):
- *Sales:* Sales Report (by customer / date / rego / type; cash vs account; internal only), Sales Breakup, Item Sales (by group / supplier / brand / code / category), Sales by Payment Method.
- *Stock:* Stock Value, Stock Listing (by type), Stocktake Variance, Stock Status.
- *Workshop:* Work In Progress, Service Due, Rego Renewal Due, Vehicle Listing, Quote Report, Follow-Up, Bookings, Loan Car History.
- *Mechanic:* Performance, Time Sheet, No Labour Times.
- *Customer:* Balances, Outstanding Balances, Listing, Customer Sales.
- *Supplier:* Purchases, Item Purchases, Vendor Listing, Vendor Balances.
- *Log:* Status of Invoices/Payments, Transaction Log (audit: invoice, bookings, PO, company settings, supplier invoice).
- **Statements** module. **Business Intelligence** dashboards (Gold).

### WS-SET — Settings
- **Company Settings:** business number, timezone, member numbers, 2FA, SSO · *Product:* default labour product, cost type (average / current), reserved stock, include on-order qty, flat rate · *Vehicle:* vehicle groups, default service interval, default contact method, advanced vehicle fields, fleet code · *Booking:* shop opens/closes, show all shop for month, description→status comment, mechanics for diary, default work hours/day · *Tax:* tax name, purchases & sales rate, default tax group, prices include tax, tax freight, round total, multiple taxes, discount includes tax · *Invoice:* 9 print formats, top margin, terms, bundle print style, hide part numbers / labour qty / line prices / header, barcode on job card, invoice no. = job no., block process if orders attached, pricing on job card, show company details, hide letterhead, hide tyre details, running totals, merge bundle, hours-worked field, hide tax on lines, prevent split notes, ask due dates on process, bilingual labels, today as post date, use service advisors · **Next numbers** (invoice, credit, PO, receipt, supplier payment) · **Variable labels** (vehicle title, plate field, VIN field, fleet code, employee title, member number) · Dealer access.
- **Company Lists:** invoice note templates, job card note templates, document templates, email templates, unit-for-sale templates, SMS templates, customer sources, payment methods, product categories, product groups (with sales / purchase accounts).
- **Messages:** invoice / job card / statement / quote / cash-invoice footers; invoice, supplier-invoice, statement, supplier, customer, inspection email texts; invoice SMS (160), email + SMS booking confirmations, loan-car T&Cs, bulk SMS default, payment-request email/SMS.
- **Reminders:** auto service reminders (days before, email + SMS text), rego renewal, WOF renewal, auto booking reminders (days before), auto quote follow-ups (days after).
- **Public Booking:** public URL, appointment types (description, est. hours), schedule hours, diary-full %, send link in reminders, logo, navbar & header colours.
- Customer Portal, Video Settings, Price Matrix, Schedule.
- **Company Profile:** icon, letterhead, address, country, language (EN-UK/US, ES), verified email, phone, **SMS credits (Buy SMS)**, subscription & billing.
- **User Profile:** change password, receipt-for-cash preference, persist grid filters.

### WS-ACT — Actions
- **Send Reminders** (batch run), **Communication Centre** (SMS/email log, bulk SMS), Export, **Import** (customers, vehicles, suppliers, products incl. price file, vehicle history header + lines, bundle parent + items, serial numbers; "first row contains column names"; analyse-then-import).

### WS-MOB — Mobile app (iOS / Android)
- Bookings, job cards, customers, suppliers, products on tablet; **technician time clocking**, photos/videos, inspections on phone; mobile-user permission flags.

### WS-INT — Integrations
- Accounting: Xero, QuickBooks Online, MYOB (+ QuickBooks export). Parts: Repco, Burson, Ashdown Ingram, PROLink, Oscar, Partstech, TireConnect, hsy, Parts Authority, GSF (AU/US). Data: Carfax VIN decode, WorkshopData labour times, DVLA/MOT (UK), Vehicle Visuals / vvGarage. Marketing: MailChimp, Podium (reviews). POS. WorkshopPay. WorkshopWeb. Public API & public booking API (Platinum). Multi-site / franchise head office (Platinum).

## 4. Notable product decisions worth copying
1. **One document, many states** — quote, booking, job card, invoice and credit are one record whose *type* and *status* change. Every report, search and customer/vehicle history hangs off it.
2. **Cost on every line** — unit cost travels with the line so *Profit* appears on the dashboard and every sales report without a separate costing step.
3. **Nothing is deleted** — customers, vehicles and users are archived / inactive / blocked; documents are voided.
4. **Configurable lists everywhere** — statuses, sources, payment methods, groups, templates, footers, SMS texts are tenant data, not code.
5. **Communication is first-class** — every list row has SMS/Email; every document has a "Contacted" flag; reminders are automated.
6. **Mobile users are a separate, cheaper licence** with reduced data exposure (*Limit Customer Information*).

## 5. What does *not* transfer to Namibia / South Africa
- WOF (NZ), rego renewal (AU), AMS / Capricorn member numbers (AU/NZ trade groups), MOT/DVLA (UK), Carfax (US), the AU/US parts-supplier catalogues, WorkshopPay (not offered in AF), GST wording.
- Local equivalents to specify instead: **VAT 15 %** (NamRA / SARS), **licence-disc expiry**, **roadworthy certificate**, NaTIS plate formats, **N$ / R** currency, WhatsApp as the dominant customer channel, EFT with proof-of-payment as the dominant B2B payment, Sage / Xero / QuickBooks for accounting, local parts suppliers (Midas, AutoZone, Goldwagen, Masterparts, Cymot) as future integrations.
