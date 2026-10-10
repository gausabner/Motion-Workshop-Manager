# Content plan — the wording, from first visit to daily use

Written 9 October 2026 after reading every public page, the registration and
sign-in flow, the pages a workshop's own customers see, and a cross-section of
the signed-in app (dashboard, jobs, transactions, a processed invoice, the
setup checklist, settings, billing, error and validation messages, and the
transactional emails). Reviewed against Impeccable's `clarify` playbook: what
happened, what matters, what to do next.

**Voice chosen: crisp and formal.** Plain formal English, precise and calm.
User-friendly through clarity, not personality.

---

## 1. Verdict

The writing is honest and specific, and in places very good — the help
library, the customer approval page, password recovery and most validation
messages already do exactly what they should. Three things hold the product
back:

1. **The paid path is invisible.** Every call to action before sign-in says
   "Book a demo" or "Talk to us". Registration works, takes a plan and a
   payment, and nothing on the landing or pricing page leads to it.
2. **The voice is clever where it should be clear.** Literary captions ("A
   price, before anybody has committed to anything"), asides ("honestly",
   "which is the point", "if you stop existing") and trade shorthand ("Told",
   "Came back", "at its foot") ask the reader to decode. A formal voice removes
   all of it.
3. **The same thing has several names.** Transactions / Transaction Centre;
   Buying / Purchasing; Who owes us / Owed to us / Receivables; Create your
   account / Create your workshop. Each pair costs a moment of doubt.

There are also four outright errors (§4, P0) to fix first.

## 2. The voice: crisp and formal

**Principles**

- **Lead with the fact.** The first sentence says what the reader needs to
  know; the second says what to do; anything else follows or is cut.
- **Formal, not stiff.** Full sentences, active voice, "you" for the reader and
  "we" or "MOTION" for the company. Plain words over official ones: "use", not
  "utilise"; "before", not "prior to".
- **No wit.** No jokes, wordplay, rhetorical asides, or unverifiable comparisons
  with other software. Confidence comes from precision.
- **Name the consequence.** Anything touching money, access or deletion says
  exactly what happens and how to recover.
- **Say it once.** If a heading explains the state, the intro adds something new
  or is removed.

**Tone by moment**

| Moment | Tone | Example |
| --- | --- | --- |
| First visit | Confident, specific | "Quotes, job cards, invoices and payments on a single document, entered once." |
| Registering and paying | Reassuring, procedural | "We activate your workshop once your payment is confirmed, usually on the same working day." |
| Daily work | Terse, scannable | "3 open job cards." |
| Errors | Calm, exact, recoverable | "This invoice has been processed and cannot be edited. Create a credit note to correct it." |
| Money at risk (overdue, read-only, suspended) | Serious, never alarming | "Your subscription payment is overdue. MOTION is read-only until it is received; your records are unaffected." |
| Success | Brief | "Payment recorded. Tax invoice MWM-00002 sent to the owner." |

**Mechanics**

- Sentence case for headings and buttons. Buttons are verb + object: "Create
  quote", "Record payment", never "Yes", "OK" or "Submit".
- British spelling, as now: licence, colour, organise.
- Currency: one format everywhere (decision D7). Percentages without a space:
  "15%".
- Dates: "8 October 2026" in sentences; dd/mm/yyyy in tables.
- Validation messages are complete sentences ending in a full stop, and name the
  field.

## 3. Glossary

One name per concept, used in navigation, page titles, headings, buttons, help
articles and emails alike.

| Concept | Use | Retire | Note |
| --- | --- | --- | --- |
| Signing up | Register your workshop | Create your account, Create your workshop | |
| All documents list | Transactions | Transaction Centre | |
| Buying from suppliers | Purchasing | Buying | |
| Money owed to the workshop | Debtors | Who owes us, Owed to us | Decision D2 |
| Money owed to suppliers | Creditors | What we owe, We owe suppliers | Decision D2 |
| Sales figures | Sales | Takings, Sold today | |
| Document sent to the customer | Sent | Told | Transactions column |
| Returned job | Rework | Came back | Document action |
| Fully paid invoice | Paid (a settled credit note: Settled) | Closed | Decision D4 |
| Monthly CSVs for the bookkeeper | Accounting export | For the bookkeeper | Every plan |
| Nightly journal to the accounting system | Accounting integration | Hand-off, Accounting hand-off | Council plan |
| Report groups | Management reports, Audit reports | For the owner, For the auditor | |
| The estimate document | Quote; printed title Quotation | — | Decision D1 |
| Open work | Open job cards | Jobs on the floor | |

## 4. Findings, by priority

### P0 — wrong, broken or blocking (fix first)

| Where | Now | Change to | Why |
| --- | --- | --- | --- |
| Register | "Workshop address" with prefix `motion.app/` | "Web address" with prefix `motionworkshopmanager.com/` and the hint "Where your team will sign in. Lowercase letters, numbers and hyphens." | Reads as a street address, and the domain shown is not MOTION's. |
| Landing, Pricing | Only "Book a demo" / "Talk to us" | Add "Register your workshop" beside "Book a demonstration"; on pricing, "Register on Workshop" / "Register on Full workshop" per plan | The self-serve paid path exists and no page leads to it. |
| Register | No mention of what follows | A short "What happens next" block above the button: reference by email → pay by EFT or deposit → activated once confirmed, usually the same working day | People commit before knowing they must pay by bank before they can use it. |
| Pricing | "…licence disc, roadworthy, WhatsApp.." and "15 %" | "…WhatsApp." and "15%" | Typo and inconsistent spacing. |
| Landing | "…every export records who took it. Most workshop software cannot answer those at all." | Remove the second sentence | "Those" refers to nothing, and the comparison cannot be substantiated. |
| Setup checklist | "Invite your mechanics" comes before any data; no import step | Add "Import your customers and vehicles" before "Invite your mechanics" | Contradicts the help library's own advice: "Import before you invite anybody." |

### P1 — gaps in the journey

- **Pricing has no answers to the questions buyers ask.** Add a short
  questions section in the formal voice: how payment works (EFT or deposit
  with a reference); when access starts; whether there is a contract (month to
  month); changing plans (immediate access, new price from the next renewal);
  tax invoices; what happens if a payment is late (seven days' grace, then
  read-only, records kept); exporting data. Every answer must match the terms
  and the product as built.
- **Support opens by sending people away.** Lead with the three ways to reach
  a person and the hours; offer the help library second. Add a line for billing
  matters (proof of payment to info@motionworkshopmanager.com). Format phone
  numbers as "+264 81 576 5935". State what happens outside office hours
  (decision D3).
- **The help library does not cover billing or half the features.** Add:
  paying for MOTION and receiving tax invoices; read-only and suspension;
  changing plan; the booking diary; inspections; the mechanic clock and floor
  app; reminders and campaigns; courtesy cars; the customer portal. Mark
  articles for features outside the Workshop plan with the plan that includes
  them.
- **Empty states are inconsistent.** Audit every list screen for first use
  (nothing yet), no results (filters) and no permission, each with one
  sentence of fact and one next action. For example, Jobs with nothing open:
  "No open job cards. Book a vehicle in from the diary or convert a quote."
- **Browser tab titles do not say where you are.** The dashboard is titled
  only "MOTION Workshop Manager", and a document page does not name the
  document. Use "Dashboard — TipTop AutoCare | MOTION" and "INV-1020 —
  Courtney Farrell | MOTION".

### P2 — the voice, applied

**Landing**

| Now | Proposed |
| --- | --- |
| From the call to the money — without anybody retyping it. | Quotes, job cards, invoices and payments on a single document, entered once. |
| A price, before anybody has committed to anything. | Price the work before the customer commits. |
| A day in the diary, on the same document. | Book the job into the diary; the quote becomes the booking. |
| Mechanics clock on. Parts come off stock against it. | Mechanics record their time, and parts are issued from stock to the job. |
| The same document, priced and sent by WhatsApp. | The job card becomes the invoice and is sent by WhatsApp or email. |
| Paid, part-paid or owing — worked out, never typed. | Payments are allocated to invoices, and the balance is calculated, never typed. |
| You open one screen and already know what the week owes you. | One screen shows the work in progress, the money outstanding and what needs attention. |
| The books can be proved | Every document is accounted for |
| It speaks the way you do | Sent by WhatsApp or email |
| See it on your own jobs / Half an hour, on a call or at your counter… | See MOTION with your own jobs / A 30-minute demonstration by call or at your workshop, using one of your recent jobs. |

**Pricing**

| Now | Proposed |
| --- | --- |
| What it costs / Priced for this market rather than converted from somewhere else… | Pricing / Monthly subscriptions in Namibian dollars. Every plan includes all your staff, and you can export your data at any time. |
| For the buyer whose procurement asks what happens if you stop existing. | For municipalities, fleets and multi-site operators that require installation on their own servers and audit reporting. |
| Stock on hand from a real movement ledger, not a number somebody edits | Stock levels calculated from every movement, never edited by hand |
| The six exports a council audit asks for, filed as PDFs and re-addable as CSVs | The six reports a council audit requires, as PDFs with CSV copies |
| The nightly journal into your accounting system — outbound only, nothing listening | A nightly journal to your accounting system, sent outbound only |
| Whichever tier you are on | Included in every plan |
| Getting started | Moving from another system |
| …two separate sets of books that cannot see each other — which is the point. | …Branches that keep separate books need separate subscriptions; each is an isolated set of books. |

**Support:** remove "and honestly"; "For a workshop that is stopped" becomes
"For urgent problems that stop work"; replace "Answered in hours rather than
minutes" with a stated response time (decision D3).

**Signed-in app**

| Where | Now | Proposed |
| --- | --- | --- |
| Dashboard intro | What is waiting, and how the month is going. | Today's work and this month's figures. |
| Dashboard labels | Waiting for someone · Takings · Sold today · Owed to us · We owe suppliers | Needs attention · Sales · Sales today · Debtors · Creditors |
| Jobs | Jobs on the floor / Move a card with the selector at its foot. | Open job cards / Change a job's status with the selector on its card. |
| Jobs buttons | Booking · Quote · Job card · Invoice | New booking · New quote · New job card · New invoice |
| Transactions | Transaction Centre; column "Told" | Transactions; column "Sent" |
| Document actions | Came back | Rework |
| Document fields | Blank = from payment terms · Written to the vehicle on process | Leave blank to use the payment terms · Saved to the vehicle record when processed |
| Reports | For the owner · For the bookkeeper · For the auditor · Hand-off | Management reports · Accounting export · Audit reports · Accounting integration |
| Activation | One payment and you are in · Nearly there | Activate your workshop · Payment details are not yet available |

**Emails:** the registration, activation, renewal, read-only, credit note and
plan-change letters follow the same voice. For example, "Welcome aboard."
becomes "Welcome to MOTION."; "Sorry for the confusion." becomes "We apologise
for the error."; "One payment and you are in" becomes "Your workshop will be
activated once payment is received."

### P3 — consistency and polish

- Validation messages: complete sentences, full stops, name the field.
  Generic ones get specific: "Check the details" names what to check;
  "Customer not found." becomes "This customer no longer exists. Refresh the
  list."
- One currency format and one percentage format across the site, app, PDFs and
  emails (decision D7).
- Default printed footers and message templates a workshop starts with
  ("Thank you for choosing us again.") follow the same voice — they are the
  workshop's words to its customers, so they must be neutral and editable.
- Legal pages are excluded: terms and privacy change only with sign-off.

## 5. The phases

Each phase is one or two pull requests. Each is reviewed in the browser at
phone and desktop width before merging, and each updates the end-to-end tests
that find elements by their wording (six spec files today).

| Phase | Scope | Size |
| --- | --- | --- |
| 0. Decisions | The seven decisions in §6 | Your call |
| 1. Corrections | Every P0 item | One small PR |
| 2. Before sign-in | Landing, pricing (with questions), support, register, sign-in, activation, paused | Two PRs |
| 3. Names | The glossary applied: navigation, page and tab titles, report names, dashboard labels, statuses, document actions | One or two PRs |
| 4. States | Empty states, errors, validation and success messages, screen by screen | Two PRs |
| 5. Letters and documents | Transactional emails; default printed footers and message templates | One PR |
| 6. Help | New articles, plan labels, terms aligned with the glossary | One PR |

**Progress.** Phase 1 shipped on 9 October 2026 (PR #27). Phase 2 shipped on
10 October: landing, pricing with a questions section, support reordered to
lead with the ways to reach a person, sign-in, activation and paused, and
eyebrow labels removed from the public pages. Phase 3 shipped on 10 October:
the glossary applied to navigation, page and tab titles, the dashboard,
reports, purchasing, document statuses and actions, settings, plan feature
names and the printed quote title, with the shared names in
`lib/copy/terms.ts`.
Phase 4 shipped on 10 October: empty states on every list screen say what
is missing and what to do; the permission, not-found and error screens and
the plan and read-only notices follow the voice; about 150 error and
validation messages are complete sentences, a record that has gone always
reads "This … no longer exists. Refresh the page.", and required fields name
themselves ("Enter the make.") instead of showing Zod's default English.

Repeated terms move into one small module (`lib/copy/terms.ts`) so a rename
happens once. A translation framework is not proposed; MOTION is English-only.

## 6. Decisions (settled 9 October 2026)

1. **Quote everywhere** in the app and on the pages; the printed document's
   title is **Quotation**. (Phase 3.)
2. **Debtors and Creditors** replace "Who owes us" and "What we owe". (Phase 3.)
3. **Support promise:** email is answered **within one working day**. Outside
   office hours — evenings, Saturdays, Sundays and public holidays — messages
   are answered first thing on the next working day; the support page says so,
   and lists what a workshop can do itself in the meantime (URGENT on WhatsApp,
   resetting a password, re-inviting staff, the floor app working offline).
   (Done in Phase 1.)
4. **Paid** replaces "Closed" for a fully settled invoice; "Closed" stays
   internal. (Phase 3.)
5. **Self-registration is promoted** beside the demonstration on the landing
   and pricing pages, and from the sign-in page. (Done in Phase 1.)
6. **Council tier:** "Request a quote". (Done in Phase 1.)
7. **Currency:** "N$ 1,380.00" — the spaced form `money()` already produces,
   now used on the public pages too. (Done in Phase 1 for the pages touched.)
