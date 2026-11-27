# Data protection, retention and exit

What MOTION holds on your behalf, how long it holds it, who can reach it, and
how you get all of it back. Written for an organisation's information officer and for
whoever signs the contract.

Companion to [the security whitepaper](security-whitepaper.md), which covers
how the data is defended. This one covers what happens to it.

Last reviewed 25 November 2026. **Draft**: the supplier is Omzizi Investment
CC, trading as Motion Dynamic Systems (CC/2014/11996), but the terms and this
document have not yet been settled by counsel. Points still to be decided are
marked. The November review of the terms is in
[legal-review-2026-11.md](legal-review-2026-11.md), and the check of the fleet
features against the law in [compliance-check-2026-11.md](compliance-check-2026-11.md).

---

## 1. Who is who

You are the **controller** — the *responsible party*, in South Africa's
POPIA. Your customers and your staff gave their details to you, not to us,
and you decide what is collected and why.

MOTION is the **processor** — the *operator*, in POPIA. We hold and handle that
information on your instructions, and for no purpose of our own.

> **To decide.** POPIA requires a written contract between the two, with the
> operator's security measures in it. These pages are not that contract. A
> short data processing schedule, attached to the terms, is outlined in the
> legal review and is owed before a South African customer.

Where MOTION is installed on your own server, we process almost nothing: the
data stays on your hardware and reaches us only when you send it — a screenshot
attached to a support request, or an export you choose to share.

## 2. What is held

**About your staff.** Name, email address and mobile number; what they are
permitted to do; the workshops and bays they work at and in what role
(mechanic, artisan, intern); their pay number and designation where you record
them; the appointments they hold (foreman, deputy, divisional head, fleet
coordinator); the jobs they are assigned to; the sign-offs they give on job
cards and requisitions, which copy their name and pay number at the time; the
time they clock on jobs and why they stopped; their working hours and time
off; and the notifications sent to them about their work. A password is never
stored — only a value derived from it that cannot be turned back into the
password.

A sign-off is a recorded act — who, with which pay number, when, and the
decision — not a drawn signature. Nothing biometric is collected: no
fingerprints, no faces, no location.

**On a mechanic's phone.** The floor app keeps two things on the device so it
works without a signal: clock taps not yet sent, and the last floor page that
loaded (that mechanic's jobs, with plates and departments; no prices, no
customer contact details). Signing out removes the kept page. Unsent taps are
kept per person and sent only when that person is signed in, so a shared
phone never sends one mechanic's time under another's name.

**About your customers.** Whatever you enter: typically a name, telephone
number, email address, postal address, and the vehicles, jobs, documents and
payments attached to them.

**About activity.** Who did what inside MOTION, with a timestamp — including who
exported data. A workshop's books have to be provable, and that record is what
makes them so.

**Not held.** No card numbers and no bank credentials. MOTION records that a
payment happened, by which method, and any reference you type; it does not
process cards and stores nothing that could be used to take money.

## 3. What is never done with it

- Not sold, and not shared with anybody for their own purposes.
- Not used to train models.
- Not used to market anything to your customers.
- Not mixed with another workshop's data. Separation is enforced by the
  database itself, not by application code remembering to filter.

## 4. Who can reach it

| Who | What they can reach |
| --- | --- |
| Your own staff | What their role permits, and nothing outside your workshop. Contact details are removed on the server for roles without that permission — including in exports, so a download is never the way around a permission. |
| MOTION staff | On the hosted service, only what is needed to operate or support it, and only when operating or supporting it. On an installed site, nothing without your action. |
| Your customers | Only their own documents, through an expiring, revocable link. No account, no password, no access to anything else. |
| People told by a notification | Only the people the rules name for that event — the foreman, deputy and staff of the place a vehicle is sent to, the people assigned to a job, the next person to sign a requisition — never the person who acted. A notification carries the job number, the vehicle and staff names; never a customer's telephone, email or address. |
| Anyone else | Nothing. |

> **To decide.** A named subprocessor list, in the form a public body will ask for.
> The parties are now known — Namecheap for the server and for Private Email,
> which carries password-reset messages and so handles a name and an address;
> Cloudflare for DNS and the edge; and whichever provider holds the backup
> bucket — so this is drafting rather than deciding. Owed before any contract.

## 5. How long it is kept

| What | How long |
| --- | --- |
| Your workshop's records, while you are a customer | Indefinitely — they are your books |
| After you stop | A return window, then removed. **To decide: the length.** Long enough that a workshop coming back does not find its history gone |
| Accounting records | Seven years is the working assumption for this market. **To decide: confirm with an accountant before publishing a figure** |
| Hand-off files MOTION keeps its own copy of | Configurable per workshop, defaulting to seven years |
| Audit trail | For the life of the workshop's account. Removing it would defeat its purpose |
| Clocked time | At least three years after the last entry — South Africa's Basic Conditions of Employment Act requires it of the employer |
| Notifications | **To decide.** Twelve months is proposed; nothing is removed today |

**Nothing is deleted for non-payment.** A lapsed subscription becomes read-only;
the data stays and can still be exported. A workshop locked out of its own books
over a declined card is a workshop lost in anger, and cash flow here is seasonal.

**Automatic deletion is not yet implemented.** The retention setting exists and
is what a future sweep will read; today, removal is a deliberate act on request.
Said plainly because a policy describing a sweep that does not run is worse than
one that admits the position.

## 6. Deletion on request

Ask and it is done, within what the law allows, and we will say which records
are being kept and why if any are.

Where the request concerns one of *your* customers, it comes to you first. They
are your customer and the record is yours to correct or remove — MOTION gives
you the tools to do it without us, which is faster for them and cheaper for
everyone.

## 7. Getting everything out

Any owner can download **every table as CSV in one archive**, at any time,
without asking and without notice. It carries a README explaining how the
tables join, and it opens in any spreadsheet.

Flat files rather than a database dump, deliberately: a dump is only useful to
somebody running the same version of the same product, which is exactly the
dependency this exists to dissolve.

This is the answer to *what do we have if you stop existing*, and it is a
working feature rather than a clause. The download is recorded in the audit
trail like any other.

**There is no exit fee, no notice period, and no request form.**

## 8. If something goes wrong

If personal information is exposed and it affects you, you will be told
promptly and plainly: what happened, what was involved, what has been done, and
what you may need to do. Not buried, and not delayed while it is made to sound
better.

**What the law says (checked November 2026).** In South Africa, an operator
must tell the responsible party *immediately* when there are reasonable grounds
to believe personal information was reached by someone unauthorised (POPIA
section 21). The responsible party — you — then reports to the Information
Regulator through its eServices portal, which since 1 April 2025 is the only
accepted route. The Act sets no hour limit; the 72 hours some guides quote is
not in it. Namibia has no data protection law in force yet, so no deadline
applies there; the published drafts of its bill point the same way.

> **To decide.** The outer limit in hours, written into the contract.
> Proposed: immediately, and in any event within 48 hours of becoming aware.
> Do not commit to a number that cannot be met at current staffing.

## 9. Transfers

On the hosted service, your data is held **in Phoenix, Arizona, in the United
States**, on a server rented from Namecheap. Traffic reaches it through
Cloudflare, which terminates the encrypted connection at its nearest point of
presence — for a Namibian user, Johannesburg or Cape Town — and carries it on.
Backups are held in object storage and are encrypted before they leave the
server, with a key the server does not hold.

This is stated rather than buried because it is a real constraint: Namecheap
confirmed their VPS estate is United States only, so the hosted service cannot
be moved within that contract.

**For a South African client, this is a transfer abroad** under POPIA
section 72: the United States has no law South Africa treats as adequate, so
the protection must come from the contract. The data processing schedule
binds MOTION to protections substantially similar to POPIA's, and to sending
the data on to nobody but the named suppliers. **Namibia has no transfer rule
in force**; NamRA's guidance that accounting records be kept at the place of
business in Namibia is a question for each client's tax adviser, and the full
export and the installed edition are the two answers to it.

**A client who requires their data to stay in Namibia is served by the
installed edition**, on their own hardware, where the data never leaves the
building. That is what the installed edition is for, and it is the right answer
to a tender that specifies residency — not a workaround for one.
