# Brief for counsel: MOTION's terms and privacy policy

*Prepared 27 November 2026 for Omzizi Investment CC (trading as Motion Dynamic
Systems) to discuss with its legal counsel. Builds on
[legal-review-2026-11.md](legal-review-2026-11.md) and
[compliance-check-2026-11.md](compliance-check-2026-11.md).*

> **Not legal advice.** These are proposed wordings for counsel to accept,
> change or reject. Nothing here has been put into the product. The live text
> is in `web/src/lib/legal/documents.ts`, served at `/terms` and `/privacy`,
> and stays as it is until counsel has settled it.

## What we need from counsel

1. Settle the wording below for the terms and the privacy policy.
2. Settle the **data processing schedule** (section C). South Africa's POPIA
   requires one before MOTION processes personal information for a South
   African customer. It is good practice in Namibia, and Namibia's
   Data Protection Bill will probably require one once it is law.
3. Answer the questions in section D.

## A. Facts the owner has confirmed

| Question | Answer (27 November 2026) |
|:--|:--|
| Who holds the key that opens the hosted service's backups? | **MOTION.** Only the public half is on the server; the private half is held by MOTION, off the server. |
| And for an installed site? | **The customer chooses:** MOTION keeps the key for them, or the customer keeps it. |
| Where are the backups stored? | **Cloudflare R2** object storage, encrypted before they leave the server. |
| Where is the hosted service? | A Namecheap server in Phoenix, Arizona, United States, reached through Cloudflare. |
| Is a backup restored every week? | **Not on the hosted service today.** The nightly backup runs (checked 27 November: last run succeeded). The restore scripts are proven in CI on every change, and the backups were restored at commissioning. No scheduled restore of the live backups runs, because the restore needs the private key and the key is deliberately not on the server. |

The last row matters. **The current terms promise a weekly restore**, and the
security whitepaper said the same. The whitepaper is corrected in this
change. The terms need the correction in B1, or the weekly drill needs to
start. Either way, the terms should not promise what is not done.

## B. Proposed changes to the terms and the privacy policy

Each change gives the current text, the proposed text, and why. Priority:
**Must** before the first contract with an organisation that runs its own
fleet, or the first South African customer. **Should** before the first
tender. **Could** if counsel agrees.

### B1. Backups (terms, "What we will do") — Must, factual

**Current:** "Back up your data every night to storage away from the machine
that runs MOTION, encrypted so that neither we nor the storage provider can
read it, and restore one of those backups every week to prove it still works."

**Proposed:** "Back up your data every night to storage away from the machine
that runs MOTION. Each backup is encrypted before it leaves that machine, so
the storage provider cannot read it. The key that opens it is kept away from
the machine that runs MOTION: by us for the hosted service, and on an
installed site by us or by you, as you choose. We test that backups can be
restored [every month / before each release — owner to choose], and tell you
how long a restore takes."

**Why:** the current sentence is untrue twice. MOTION holds the key for the
hosted service, so "neither we … can read it" is wrong. And no weekly restore
runs. The bracketed frequency should be one MOTION will actually keep.

### B2. Payment failure (terms, "If a payment fails") — Should

**Current:** "You get a grace period."
**Proposed:** "You get a grace period of seven days after the end of the period you have paid for."
**Why:** the product already applies seven days (`BILLING_GRACE_DAYS`). The term should say what the product does.

### B3. Stopping (terms, "Stopping") — Should

**Current:** "We will keep it for a period after you stop in case you come back, and then remove it."
**Proposed:** "We keep it for [90] days after the end of your last paid month, in case you come back, and then remove it, except what the law requires us to keep."
**Why:** an undefined period cannot be relied on by either side. Owner to choose the number.

### B4. Liability (terms, "When it goes wrong") — Must

**Current:** no cap; consequential loss excluded.
**Proposed (add):** "Each party's total liability under these terms in any twelve months is limited to the fees you paid for MOTION in the twelve months before the event that gave rise to the claim. For a breach of our obligations about personal information, the limit is twice that amount. Neither party is liable for loss of profit, revenue or business, or for indirect or consequential loss. Nothing here limits liability for fraud, for wilful misconduct, or for anything the law does not allow to be limited."
**Why:** without a cap every claim is unlimited. A higher cap for personal information is normal and shows the subject is taken seriously.
**For counsel:** is this enforceable as written against a small Namibian business, and against a South African one under the Consumer Protection Act?

### B5. New clauses (terms) — Should

| Clause | Proposed text |
|:--|:--|
| **Licence and ownership** | "We give you a non-exclusive, non-transferable right to use MOTION for your own business while your subscription runs. The software, its documentation and our improvements to them remain ours. Your data remains yours. If you send us a suggestion, we may use it without owing you anything for it." |
| **Confidentiality** | "Each of us keeps the other's non-public business information confidential, during the subscription and for three years after it ends. This does not apply to information that is already public, that the other party already had, or that the law requires to be disclosed." |
| **Warranties** | "We provide MOTION with reasonable skill and care. Beyond that, and as far as the law allows, MOTION is provided as it is." |
| **Electronic signatures** | "A sign-off recorded in MOTION — a person's name, pay number and the time — is that person's signature on a job card or a requisition, and you and we agree to treat it as one." |
| **Governing law** | "These terms are governed by the law of Namibia. Before either of us starts proceedings, the people named on the order meet, in person or by video call, to try to settle the matter. If they cannot, the High Court of Namibia in Windhoek has jurisdiction." |
| **Takedown notices** | "Notices about unlawful content stored in MOTION go to [name], at [address and email]." |
| **Force majeure** | "Neither of us is liable for a delay caused by events outside its reasonable control. If such an event lasts more than 30 days, either of us may end the subscription." |
| **Assignment** | "We may transfer these terms to a business that takes over MOTION, if we tell you first." |

### B6. Privacy: what we hold — Must

**Current (staff):** "name, email address, the workshop they belong to and what they are allowed to do."
**Proposed:** "For your staff: name, email address and mobile number; the workshops and bays they work at and in what role; their pay number and designation where you record them; the appointments they hold, such as foreman or divisional head; the jobs they are assigned to; the sign-offs they give on job cards and requisitions, which carry their name and pay number; the time they clock on jobs and why they stopped; their working hours and time off; and the notifications MOTION sends them about their work. A password is never stored — only a value derived from it that cannot be turned back."
**Why:** the November features record all of this. A notice that leaves it out fails its purpose under POPIA section 18.

### B7. Privacy: marketing — Should

**Add after "What we do not do":** "Reminders and campaigns you send from MOTION are yours. A customer whose contact preference is set to Opt out is left out of them, and MOTION warns you before any message is sent to them by hand."

### B8. Privacy: where it lives — Must

**Current:** "On the hosted service, on servers we operate." (with a note to decide)
**Proposed:** "On the hosted service, your data is held in the United States, on a server in Phoenix, Arizona, rented from Namecheap. Traffic reaches it through Cloudflare. Backups are encrypted before they leave the server and are stored with Cloudflare. Where the law of your country restricts sending personal information abroad, we apply protections substantially similar to that law to everything we hold for you, and we send it to no one else except the suppliers named below. If your data must stay in your country, the installed edition keeps it on your own hardware."
**Why:** POPIA section 72 for South African customers. Namibia has no transfer rule in force, but the bill's drafts follow the same pattern.

### B9. Privacy: who else sees it — Should

**Proposed:** "The suppliers we use to run the hosted service are Namecheap (the server, and the email service that carries password-reset messages) and Cloudflare (the network that carries traffic to the server, and the storage that holds the encrypted backups). We will tell you at least 30 days before we add or replace one. If the change does not suit you, you may stop, without penalty."

### B10. Privacy: how long it is kept — Should

**Add:** "Time clocked by your staff is kept for at least three years after the last entry, because employers must keep it that long. Notifications are kept for twelve months." *(Owner to confirm twelve months; nothing deletes them today.)*

### B11. Privacy: if something goes wrong — Must

**Current:** "If one happens and it affects you, we will tell you promptly and plainly."
**Proposed:** "If we have reason to believe that personal information we hold for you has been reached by someone not entitled to it, we will tell you immediately, and in any event within 48 hours of becoming aware: what happened, what was involved, what we have done, and what you may need to do."
**Why:** POPIA section 21(2) requires an operator to notify *immediately*. The 72 hours some guides quote is not in the Act. Forty-eight hours is proposed as a limit MOTION can meet. Counsel to confirm it reads as consistent with "immediately".

## C. Draft data processing schedule

*Attach to the terms as a schedule. Square brackets are for the owner or counsel.*

> **Schedule: Processing personal information**
>
> **1. Roles.** You are the responsible party (controller) for the personal
> information of your staff and customers held in MOTION. We are your
> operator (processor). We process it only on your instructions, which are
> the terms, this schedule, and what you do in MOTION.
>
> **2. What, whose, and why.** We hold the information listed in our privacy
> policy under "What we hold", about your staff and your customers, for the
> purpose of providing MOTION to you, and for no purpose of our own.
>
> **3. Confidentiality.** Everyone at MOTION who can reach your information
> is bound to keep it confidential, and reaches it only to operate or
> support the service.
>
> **4. Security.** We keep the safeguards described in our security
> whitepaper, including: separation of each workshop's data enforced by the
> database; role-based access with contact details removed on the server for
> roles without that permission; an audit trail of who did what, including
> exports; one-way storage of passwords and tokens; and nightly backups
> encrypted before they leave the server. We will not reduce these
> safeguards materially without telling you first.
>
> **5. Incidents.** If we have reason to believe your personal information
> has been reached by someone not entitled to it, we will tell you
> immediately, and in any event within 48 hours of becoming aware, and give
> you what you need to tell the regulator and the people affected.
>
> **6. Suppliers.** You agree to the suppliers named in our privacy policy.
> We bind each supplier to protections no weaker than these, and we remain
> responsible to you for what they do. We tell you at least 30 days before
> adding or replacing a supplier, and you may stop without penalty if you
> object.
>
> **7. Transfers.** Your information is held where our privacy policy says.
> Where the law of your country restricts transfers abroad, we apply
> protections substantially similar to that law, and we send it on to no
> one except the named suppliers.
>
> **8. Helping you.** We help you answer requests from people to see,
> correct or delete their information. MOTION's own tools let you do most of
> this without us. We also help you with security assessments and with
> anything a regulator asks about our part.
>
> **9. At the end.** When the subscription ends you can take everything out
> through the full export, at any time and without asking. We delete your
> information [90] days after the end of your last paid month, except what
> the law requires us to keep, and tell you what that is.
>
> **10. Records and checks.** We keep a record of the processing we do for
> you. On reasonable notice, not more than once a year, we answer your
> written questions about how we meet this schedule, and show you the
> evidence: the isolation tests, the audit trail and a restore of a backup.

## D. Questions for counsel

1. Does the schedule in C satisfy POPIA sections 19–21 as an operator
   agreement? What must be added for a municipality, which will also apply
   its own supply chain conditions?
2. MOTION is incorporated in Namibia. Does POPIA's Information Regulator
   guidance require it to appoint a person in South Africa before it
   processes South African customers' information as an operator, or does
   that duty fall only on the responsible party?
3. Is a liability cap of twelve months' fees, doubled for personal
   information, enforceable in Namibia, and against South African small
   businesses?
4. Should the governing law follow the customer's country for South African
   customers, or stay Namibian with the High Court in Windhoek?
5. Hosting in the United States: is a contractual undertaking (B8, C7)
   enough under POPIA section 72(1)(a), or is customer consent also advisable?
6. NamRA guidance says accounting records must be kept at the place of
   business in Namibia. Does a hosted service with a full export on demand
   satisfy that for a Namibian workshop, or should the terms advise them to
   keep their own export?
7. Is a sign-off recorded in MOTION (name, pay number, time) a valid
   signature for a council's job cards and requisitions under the Electronic
   Transactions Act, given that both parties agree to the method in the terms?

## E. What the owner still has to choose

| Choice | Where |
|:--|:--|
| How often the hosted backups are restored as a drill, and by whom | B1 |
| The return window after a customer stops (90 days proposed) | B3, C9 |
| The name and address for takedown notices | B5 |
| How long notifications are kept (12 months proposed) | B10 |
