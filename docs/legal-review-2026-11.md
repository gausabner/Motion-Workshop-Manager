# Terms and privacy review — November 2026

*A review of MOTION's own customer terms and privacy policy after the fleet
features shipped. Written 25 November 2026 against `web/src/lib/legal/documents.ts`
(both documents dated 30 September 2026) and [data-protection.md](data-protection.md).*

> **Not legal advice.** This is a structured reading against general commercial
> standards, to prepare the questions for counsel. Neither document has been
> seen by anybody admitted to practise in Namibia or South Africa. Nothing in
> `documents.ts` has been changed by this review: the redlines below are
> proposals, and the text served at `/terms` and `/privacy` stays as it is
> until they are agreed.

## Contract review summary

| | |
|:--|:--|
| **Documents** | Terms of use (`TERMS`, 11 clauses) and privacy policy (`PRIVACY`, 10 clauses), served at `/terms` and `/privacy`; the draft data-processing position in `docs/data-protection.md` |
| **Parties** | Omzizi Investment CC, trading as Motion Dynamic Systems (CC/2014/11996, VAT 06658872-015), as supplier; the subscribing workshop or organisation as customer |
| **Our side** | Vendor |
| **Deadline** | None set. Must be settled before the first contract with an organisation that runs its own fleet, and before any South African customer |
| **Review basis** | Generic commercial standards. No playbook is configured for MOTION; a short one is proposed at the end |
| **Facts relied on** | [reports/MOTION compliance and market facts.md](../reports/MOTION%20compliance%20and%20market%20facts.md) (November 2026) |

## Key findings

1. **RED — No operator agreement.** MOTION processes the customer's personal
   information on its behalf, but neither document is the written contract
   POPIA requires between a responsible party and an operator (sections 20–21),
   and the privacy policy promises breach notice "promptly" where the Act says
   "immediately".
2. **RED — The privacy policy understates what is held about staff.** Since
   November MOTION records pay numbers, designations, workshop places,
   appointments, assignments, sign-offs, clocked time, working hours and time
   off, and notifications that name people. The policy still lists name,
   email, workshop and permissions.
3. **RED — Where the data lives is still marked "decide".** Production is in
   Phoenix, Arizona, on Namecheap. For a South African customer that is a
   transfer out of the country under POPIA section 72, and neither document
   says so or carries the protection.
4. **RED (for us) — No liability cap.** The terms exclude consequential loss
   but cap nothing. Every claim is uncapped.
5. **YELLOW — No governing law, licence, confidentiality or warranty clauses.**
   Each is standard and each will be asked for.

## Clause-by-clause analysis

### What you are agreeing to — GREEN

**Says:** the terms cover hosted and installed use; a signed written agreement
wins where they disagree. **Comment:** the right shape for public bodies, who
contract on their own conditions. Keep it.

### Your data belongs to you — GREEN

**Says:** the data stays the customer's, is not sold or used for training, and
can be exported whole at any time. **Comment:** true of the product (the
bundle export exists and is audited). Better than market.

### What we will do — YELLOW

**Says:** keep it running, answer support, back up nightly "encrypted so that
neither we nor the storage provider can read it", restore weekly.
**Deviation:** the security whitepaper says the backup's private key is held
by the workshop or organisation, not by MOTION. That is true of an installed
site. For the **hosted** service, one backup covers every tenant and someone
at MOTION must hold the key to restore it. If so, "neither we … can read it"
is not true of the hosted service.
**Redline:**

> Back up your data every night to storage away from the machine that runs
> MOTION. Each backup is encrypted before it leaves that machine, ~~so that
> neither we nor the storage provider can read it~~ **so that the storage
> provider cannot read it; the key that opens it is kept off the server,
> and on an installed site it is held by you rather than by us.**

**Priority:** must-have (an inaccurate security statement is the worst kind).
**Fallback:** keep the sentence only if the hosted key really is held outside
MOTION, and say by whom.

### What you will do — GREEN

Acceptable use, logins, paying. Adequate. Consider adding that the customer
is responsible for having told its staff and customers what MOTION records
(their POPIA section 18 notice); see the operator agreement below.

### Paying — GREEN

Monthly, N$, per workshop, 30 days' notice of price changes, VAT 15 % added
with the VAT number stated. Correct for Namibia (15 %, unchanged in 2026).
**Note for South African customers:** a Namibian supplier of electronic
services into South Africa has its own SARS registration question. That is a
question for a tax adviser before the first South African invoice, not a
terms change.

### If a payment fails — YELLOW

**Says:** "a grace period", then read-only. **Deviation:** the length is not
stated. The code sets it: `BILLING_GRACE_DAYS`, seven days by default
(`web/src/lib/billing/periods.ts`).
**Redline:** "You get a grace period ~~.~~ **of seven days after the end of
the period you paid for.**" **Priority:** should-have.

### Stopping — YELLOW

**Says:** month to month, no notice, no exit fee; data kept "for a period".
**Deviation:** the period is undefined here and in the privacy policy.
**Redline:** name it — "**for 90 days after the end of your last paid month,
then removed**" — or whatever figure is chosen. **Priority:** should-have.

### When it goes wrong (limitation of liability) — RED

**Says:** no liability for consequential loss; nothing limits what the law
does not allow to be limited. **Deviation:** no cap. A data-protection claim
by an organisation with a fleet of several hundred vehicles is not bounded by
anything in the document.
**Redline:**

> **Each party's total liability under these terms in any twelve months is
> limited to the fees you paid for MOTION in the twelve months before the
> event that gave rise to the claim. For a breach of our obligations about
> personal information, the limit is twice that amount.** Neither party is
> liable for loss of profit, revenue or business, or for indirect or
> consequential loss. Nothing here limits liability for fraud, for wilful
> misconduct, or for anything the law does not allow us to limit.

**Rationale (for the customer):** a cap tied to fees is the market norm for
software at this price, and the higher figure for personal information shows
it is taken seriously. **Priority:** must-have. **Fallback:** accept a higher
data-protection cap a public body insists on in its own signed agreement,
which already wins over these terms.

### Installed on your own server — GREEN

Clear split of responsibilities, and the outbound-only description matches
the product.

### Changes to these terms — GREEN

Notice in advance, stopping always available. A signed agreement wins, so
public bodies are not bound by a unilateral change.

### Absent clauses

| Clause | Rating | Proposed text (summary) | Priority |
|:--|:--|:--|:--|
| **Governing law and disputes** | YELLOW | The law of Namibia; the High Court of Namibia in Windhoek; a meeting between the parties' named people before any proceedings. A South African public body will contract on its own conditions, which the first clause already allows for | Should-have |
| **Licence and ownership** | YELLOW | We grant you a non-exclusive, non-transferable right to use MOTION for your own business during the subscription. The software, its documentation and improvements to them remain ours; your data remains yours. Suggestions you send may be used without obligation | Should-have |
| **Confidentiality** | YELLOW | Each party keeps the other's non-public business information confidential, during the subscription and for three years after, with the usual exceptions (already public, required by law) | Should-have |
| **Warranties** | YELLOW | We provide MOTION with reasonable skill and care. Otherwise MOTION is provided as it is, to the extent the law allows. Counsel to confirm what statutory terms cannot be excluded against a small business | Should-have |
| **Electronic signatures** | YELLOW | The parties agree that a sign-off recorded in MOTION (name, pay number, time) is their signature on a job card or requisition. Namibia's Electronic Transactions Act treats such signatures as valid between parties who agree to the method; it should be written down | Should-have |
| **Takedown agent** | YELLOW | Name an agent for notices about unlawful content stored by customers, with contact details, as the Electronic Transactions Act requires a storage provider to publish to keep its protection | Should-have |
| **Indemnity** | GREEN, prepare one | None given or taken. Public bodies will ask for an IP indemnity; have a capped one ready rather than drafting it in a negotiation | Nice-to-have |
| **Force majeure** | YELLOW | Neither party liable for delay caused by events outside its reasonable control; either may end the subscription if one lasts over 30 days | Nice-to-have |
| **Assignment** | YELLOW | We may transfer these terms to a successor carrying on the business, with notice. Matters because a close corporation may become a company | Nice-to-have |

### Privacy: What we hold — RED

**Says (staff):** "name, email address, the workshop they belong to and what
they are allowed to do."
**Deviation:** incomplete since the November features. The schema now holds
for staff: mobile number; pay number and designations (`Membership`); the
workshops and bays they work at and in what role (`WorkshopStaff`);
appointments as foreman, deputy, divisional head or fleet coordinator
(`SigningAuthority`); the jobs they are put on (`VisitAssignment`); sign-offs
with their name and pay number (`JobSignoff`, requisition approvals); clocked
time with stop reasons (`TimeEntry`); working hours and time off with a
free-text reason (`WorkingHours`, `TimeOff`); and notifications that name
them (`Notification`).
**Redline:**

> For your staff: name, email address and mobile number; the workshops and
> bays they work at and in what role; their pay number and designation where
> you record them; the appointments they hold (such as foreman or divisional
> head); the jobs they are assigned to; the sign-offs they give on job cards
> and requisitions, which carry their name and pay number; the time they
> clock on jobs and why they stopped; their working hours and time off; and
> the notifications MOTION sends them about their work. A password is never
> stored — only a value derived from it that cannot be turned back.

**Priority:** must-have. A notice that understates what is collected fails the
purpose of a notice under POPIA section 18 and will be found by any
information officer who opens the job card.

### Privacy: What we do not do — YELLOW

**Says:** "We do not use your customers' details to market anything to them."
True of MOTION. **Deviation:** the workshop itself sends service reminders and
campaigns from MOTION. In South Africa those are probably direct marketing
(POPIA section 69) and need consent or an existing-customer relationship with
a free opt-out. The product honours "Opt out" as a contact preference in
campaigns and reminders, which should be said.
**Redline (add):** "**Reminders and campaigns you send from MOTION are yours.
A customer whose contact preference is set to Opt out is left out of them,
and MOTION warns before any message is sent to them by hand.**"
**Priority:** should-have.

### Privacy: Where it lives — RED

**Says:** "on servers we operate", with a *decide* note.
**Deviation:** production is decided and the facts are already published in
the security whitepaper: Namecheap, Phoenix, Arizona, United States; traffic
through Cloudflare; backups encrypted in object storage.
**Redline:**

> On the hosted service, your data is held in the United States, on a server
> in Phoenix, Arizona, rented from Namecheap. Traffic reaches it through
> Cloudflare. Backups are encrypted before they leave the server. **Where the
> law of your country restricts sending personal information abroad, we
> apply protections substantially similar to that law to everything we hold
> for you, and we do not send it on to anyone else except the suppliers
> named below.** If your data must stay in your country, the installed
> edition keeps it on your own hardware.

**Priority:** must-have before a South African customer (POPIA section 72).
For Namibia there is no transfer rule in force yet — the Data Protection Bill
is not law — but the bill's drafts follow the same pattern, so writing it now
costs nothing. NamRA's guidance that accounting records be kept at the place
of business in Namibia should be checked with a tax adviser for hosted
customers; the installed edition and the full export are the answers to give.

### Privacy: Who else sees it — YELLOW

**Deviation:** the subprocessors are known and should be named: Namecheap
(server, and Private Email for password-reset messages), Cloudflare (DNS and
the edge), and the backup bucket's provider (to be confirmed and named).
**Redline:** replace the *decide* note with that list and a promise of 30 days'
notice before a new one is added, with the right to stop if it does not suit.
**Priority:** should-have.

### Privacy: How long it is kept — YELLOW

**Deviation:** seven years is "assumed, not verified". What is verified: South
Africa's Basic Conditions of Employment Act requires time and pay records for
three years from the last entry, so clocking data must not be swept sooner.
Namibia's retention periods were not confirmed from a primary source.
**Redline:** keep "seven years" marked as the working figure until an
accountant confirms it, and add "**time records for at least three years
after the last entry**". **Priority:** should-have.

### Privacy: Security — YELLOW

**Says:** "we will tell you promptly and plainly." **Deviation:** POPIA section
21(2) says an operator must notify the responsible party *immediately* where
there are reasonable grounds to believe personal information was accessed by
an unauthorised person. The responsible party then reports to South Africa's
Information Regulator through its eServices portal (since 1 April 2025). The
Act sets no hour limit; the 72 hours some guides quote is not in it.
**Redline:** "we will tell you ~~promptly~~ **immediately, and in any event
within 48 hours of becoming aware,** and plainly". **Priority:** must-have for
South Africa. **Fallback:** "without undue delay" with a 72-hour outer limit,
if 48 cannot be met at current staffing.

## The missing document: an operator agreement

The four RED findings come down to one missing document. Proposed: a short
**Data Processing Schedule** attached to the terms, written once for both
countries, covering:

1. Roles — the customer is the responsible party (controller); MOTION is the
   operator (processor) and processes only on the customer's instructions.
2. What is processed, about whom, for what — the lists above, kept in step
   with the schema.
3. Security measures — by reference to the security whitepaper, sections 3–8.
4. Breach notice — immediately, outer limit in hours as agreed.
5. Subprocessors — the named list, notice of changes, right to object.
6. Transfers — the hosting location and the protection applied.
7. Assistance — with access, correction and deletion requests, which the
   product already supports.
8. End — return through the full export, then deletion after the stated
   period, with what is kept by law and why.

## Negotiation strategy

**Tier 1 (do not sell to an organisation with its own fleet, or into South
Africa, without):** the operator schedule, the corrected staff list, the
hosting and transfer clause, and the liability cap.

**Tier 2 (have ready before the first tender):** governing law, licence,
confidentiality, warranties, electronic signatures, the subprocessor list, the
breach window, the retention figures.

**Tier 3 (concede if asked):** force majeure wording, assignment, the length
of the return window, a higher data-protection cap in a signed agreement.

## Next steps

1. ~~Decide who holds the hosted backups' private key~~ — decided 27 November:
   MOTION holds it; an installed site chooses MOTION or itself. Proposed
   wording in [counsel-brief-2026-11.md](counsel-brief-2026-11.md), B1, which
   also corrects the weekly-restore claim (no scheduled restore runs on the
   hosted service).
2. ~~Name the backup bucket's provider~~ — Cloudflare R2.
3. Take this review, [compliance-check-2026-11.md](compliance-check-2026-11.md)
   and the operator schedule outline to counsel admitted in Namibia; and, before
   a South African customer, to counsel admitted there.
4. When the text is agreed, change `documents.ts` once, update `TERMS_UPDATED`
   and `PRIVACY_UPDATED`, and tell existing customers what changed, as the
   terms promise.

### A playbook for next time

A `legal.local.md` with MOTION's standard positions would turn the next review
from generic into specific: the cap (twelve months' fees, twice for personal
information), the breach window, governing law (Namibia), the return window,
and which of these a public body may change in its own agreement.
