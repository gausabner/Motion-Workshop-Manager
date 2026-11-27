# Compliance check — the November 2026 features

*Checked 25 November 2026, at `main` 5413cad. Covers what shipped in PRs
#38–#61: the fleet route and its sign-offs, stores and purchase requisitions,
workshop staff and assignment, notifications, and the floor app's clock,
schedule and offline queue. Facts on the law are from
[reports/MOTION compliance and market facts.md](../reports/MOTION%20compliance%20and%20market%20facts.md).*

> **Not legal advice.** A structured check to prepare decisions and questions
> for counsel. The law moves; each fact below carries the date it was
> checked against.

## Summary

**Proceed with conditions.** The features are built in a way the law can live
with: data is scoped per tenant and enforced by the database, notifications
carry no customer contact details, sign-offs record who and when rather than
a drawn signature, and the procurement rules are settings rather than
constants. The conditions are paperwork MOTION owes its customers — an
operator agreement, an accurate staff notice, a stated hosting location — and
two small product changes. None blocks selling to a Namibian workshop. The
operator agreement and the transfer clause must exist before a South African
customer.

## Applicable regulations and policies

| Regulation | How it applies | Key requirements |
|:--|:--|:--|
| **POPIA** (South Africa), checked November 2026 | A South African customer is the *responsible party*; MOTION is its *operator* | Written operator contract with security measures (s20–21); operator tells the customer **immediately** of a suspected breach (s21(2)); the customer reports to the Information Regulator through eServices (since 1 April 2025), with no fixed hour limit in the Act; staff and customers told what is collected (s18); transfers abroad only with substantially similar protection (s72); consent or existing-customer opt-out for electronic marketing (s69); special personal information, such as health or biometrics, needs a lawful ground (s26–27) |
| **Namibia — no data protection law in force** (checked to March 2026) | The Data Protection Bill is still a bill: no regulator, no registration, no breach deadline, no transfer rule | Article 13 of the Constitution protects privacy. Write to the bill's direction (consent-led, transfers only with similar protection) so nothing has to be redone when it passes |
| **Electronic Transactions Act 4 of 2019** (Namibia) | MOTION stores data for others, so it is a *service provider*; job cards and requisitions are electronic records with electronic sign-offs | Publish a named agent for takedown notices to keep the Act's liability protection; electronic records count only if integrity, origin and time can be shown; a recorded sign-off is a valid signature between parties who agreed to the method. The signature section came into force 15 June 2026 |
| **Basic Conditions of Employment Act s31** (South Africa) | Clocked time in the floor app is the employer's time record | Keep time records for three years from the last entry |
| **Municipal Supply Chain Management Regulations**, as amended 14 December 2023 (South Africa) | A municipality's purchase requisitions follow its supply chain policy | Written quotations from R2,000 up to R300,000 (local), R200,000 (district) or R750,000 (metro), VAT included; competitive bidding above; at least three written quotations from accredited suppliers, or the reasons recorded and approved; splitting a purchase to avoid a threshold prohibited; above R30,000 advertised for seven days. A municipality's own policy may be stricter |
| **Public Procurement Act 15 of 2015 and regulations**, thresholds from 4 August 2026 (Namibia) | A council's or state-owned company's purchase requisitions | Small-value procurement up to N$30,000; sealed quotations up to N$3 million; restricted bidding up to N$5 million. Regional councils are now Category 1. The minimum number of quotations per band was **not confirmed** |
| **VAT** — Namibia and South Africa, both 15 % (checked November 2026) | MOTION's own invoices, and the documents workshops issue from it | Namibia: one original tax invoice per supply, reprints marked "copy"; no invoice needed for cash sales up to N$1,000. South Africa: full tax invoice above R5,000, abridged at or below, issued within 21 days; compulsory registration from R2.3 million since 1 April 2026 |
| **E-invoicing** | Neither country has a mandate in force | South Africa: Peppol model confirmed February 2026, target around 2028. Namibia: phased over 2026/27–2028/29, no dates. Say "built for", never "compliant" |

## What the features hold, and about whom

| Feature | Personal information | About |
|:--|:--|:--|
| Workshop staff and assignment | Workshop and role (mechanic, artisan, intern); jobs assigned and when; who assigned and who ended it | Staff |
| Appointments | Foreman, deputy, divisional head, fleet coordinator, over-limit approver; for which workshop or unit | Staff |
| Sign-offs (job card, requisitions) | Name and pay number copied onto the sign-off, decision, comment, time | Staff |
| Fleet route | Who sent and received a vehicle, when; the note sent with it | Staff; the department as customer |
| Requisitions and quotations | Who raised, signed, issued, took; attached supplier quotations | Staff; suppliers' contact people |
| Floor app clock | Start and stop times per job, stop reason (parts, break, done) | Staff |
| Working hours and time off | Weekly hours; leave dates with a **free-text reason** | Staff |
| Notifications | Title and body naming the person who acted, the job number, plate, make and model | Staff (recipient and actor) |
| Offline queue and cached page (phone) | Pending clock taps; the last floor page (the mechanic's jobs, plates, department names) | Staff, on their own device |

No feature collects biometrics, location, health data by design, or customer
contact details in notifications.

## Requirements

| # | Requirement | Status | Action needed |
|:--|:--|:--|:--|
| 1 | Written operator agreement (POPIA s21) | **Not met** | Draft the Data Processing Schedule outlined in [legal-review-2026-11.md](legal-review-2026-11.md); counsel to settle |
| 2 | Staff told what is recorded about them (s18) | **Not met** | Privacy policy lists only name, email, workshop and permissions. Replace with the full list (legal review, *What we hold*) |
| 3 | Breach notice to the customer immediately (s21(2)) | **Not met in writing** | Privacy says "promptly". Commit to "immediately, and within 48 hours"; add the step to the runbook's incident section |
| 4 | Security safeguards (s19) | **Met, with known gaps** | Database-enforced tenant isolation, role permissions, server-side redaction, audit trail, encrypted off-site backups (restore proven in CI; a scheduled drill of the hosted backups is not yet running). Gaps already published in the whitepaper: no MFA, no encryption at rest on the live database, no penetration test |
| 5 | Transfers abroad (s72) | **Not met in writing** | Hosted data is in Phoenix, Arizona. State it in the privacy policy, apply substantially similar protection by contract, and offer the installed edition for residency |
| 6 | Only the people concerned are notified | **Met** | Notifications go to the people the domain rules name, never the actor, inside the same transaction; a failed move tells nobody |
| 7 | Minimal content in notifications | **Met** | Job number, vehicle and names of staff only; no customer telephone, email or address |
| 8 | Sign-offs attributable and unaltered | **Met** | `JobSignoff` and requisition approvals copy the name and pay number at the time, keep them when an appointment ends, and sit in the audit trail. Record the parties' agreement to this method in the terms (Electronic Transactions Act) |
| 9 | Time records kept three years (BCEA s31) | **Met today, at risk later** | Nothing is swept. When the retention sweep is written, it must keep time entries for at least three years after the last entry |
| 10 | Special personal information avoided | **Unknown** | Time off has a free-text reason, which invites "sick — flu". Change the label to steer away from health detail, or offer fixed reasons (leave, training, other) |
| 11 | Data on a shared phone | **Partly met** | The offline queue holds only clock taps. The cached floor page survives sign-out; anyone opening the floor address offline on that phone sees the last jobs. Clear the floor cache and the queue on sign-out |
| 12 | Notifications kept no longer than needed | **Unknown** | No retention is set for `Notification` rows. Propose twelve months, then delete |
| 13 | Procurement thresholds set per organisation | **Met** | The value limit, the over-limit approver and the quotations required at each value are settings (Settings → Requisition rules), so a municipality can enter its own policy. Effective-dated bands would let a requisition be judged by the rule on its own date; not built |
| 14 | Split purchases visible | **Unknown** | The SCM regulations prohibit splitting a purchase to stay under a band. A report of requisitions to one supplier just under a band, close together, would help an auditor; not built |
| 15 | Fewer quotations than required, with reasons | **Partly met** | The product refuses a purchase with fewer quotations than its band requires. South Africa allows fewer with recorded, approved reasons; an override with a reason and approver is not built |
| 15a | Limits compared like for like | **Not met** | Both countries' thresholds include VAT; MOTION compares requisition values and quotations excluding VAT. Until a setting says which, enter each limit as its VAT-exclusive equivalent (at 15 %, N$ 30,000 becomes N$ 26,086.96), and say so in the go-live checklist |
| 16 | Direct marketing opt-out (s69) | **Met** | "Opt out" as a contact preference is honoured by campaigns and reminders, and a hand-sent message to such a customer carries a warning |
| 17 | Takedown agent published (Electronic Transactions Act) | **Not met** | Name the agent and contact details on the support page |

## Risk areas

| Risk | Severity | Mitigation |
|:--|:--|:--|
| Selling to a South African customer without an operator agreement or transfer clause | **High** | Do not sign until requirements 1, 3 and 5 are in place |
| An information officer finds the privacy policy understates staff data | **High** | Requirement 2; the text is drafted in the legal review |
| A procurement auditor cannot tie a purchase to the rule in force on its date | **Medium** | Record each requisition's band at submission; effective-dated settings later |
| Health details typed into a time-off reason | **Medium** | Requirement 10 |
| A shared phone shows the last mechanic's jobs after sign-out | **Low** | Requirement 11; the page holds plates and department names, not money or contact details |
| Notifications kept forever | **Low** | Requirement 12 |
| Namibia's bill passes with a short breach deadline or a registration duty | **Medium** | Write to the bill's direction now; watch the ICT ministry and Parliament; review within a month of passage |

## Recommended actions

1. **Draft the operator schedule and correct the privacy policy's staff list**
   (requirements 1–3, 5). These are text, not code, and they unblock the
   first contract with an organisation with its own fleet.
2. **Two small product changes:** clear the floor app's cached page and queue
   on sign-out; steer the time-off reason away from health detail.
3. **Before South Africa:** counsel admitted there, the transfer clause, an
   Information Officer question (the Regulator's guidance expects one based in
   South Africa for a responsible party incorporated abroad; MOTION as an
   operator should confirm what applies to it), and a tax adviser on SARS
   registration for electronic services.
4. **Procurement, when a municipality asks:** a reasoned override for fewer
   quotations, effective-dated bands, and a near-threshold report.
5. **Set retention:** notifications twelve months; time entries at least three
   years after the last entry; the rest as the data-protection document says.

## Approvals needed

| Approver | Why | Status |
|:--|:--|:--|
| MOTION's owner (Omzizi Investment CC) | Commits the company to the operator schedule, the breach window and the liability cap | Pending |
| Counsel admitted in Namibia | Terms, privacy policy, operator schedule, electronic signatures, takedown agent | Pending |
| Counsel admitted in South Africa | POPIA operator duties, transfer clause, Information Officer question | Pending, before the first South African customer |
| Tax adviser | Namibian record-keeping location for hosted customers; SARS registration for electronic services; retention periods | Pending |
| Each customer's information officer | Their own s18 notice to staff, and their requisition rules | Per customer, at go-live ([implementation-pack.md](implementation-pack.md)) |

## Further review recommended

- The Namibian Data Protection Bill's final text, when published: breach
  timeline, registration, fines, and whether an operator has duties of its own.
- Namibia's Labour Act record-keeping for time and pay records (not researched).
- Namibia's Access to Information Act, for a public body's records held by a
  vendor (not researched).
- The minimum number of quotations per band under Namibia's procurement
  regulations, before the product's defaults are shown to a council as
  correct.
