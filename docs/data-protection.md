# Data protection, retention and exit

What MOTION holds on your behalf, how long it holds it, who can reach it, and
how you get all of it back. Written for a council's information officer and for
whoever signs the contract.

Companion to [the security whitepaper](security-whitepaper.md), which covers
how the data is defended. This one covers what happens to it.

Last reviewed 30 September 2026. **Draft**: the entity behind MOTION is not yet
registered, so clauses naming a company are not yet enforceable. Points still
to be decided are marked.

---

## 1. Who is who

You are the **controller**. Your customers gave their details to you, not to
us, and you decide what is collected and why.

MOTION is the **processor**. We hold and handle that information on your
instructions, and for no purpose of our own.

Where MOTION is installed on your own server, we process almost nothing: the
data stays on your hardware and reaches us only when you send it — a screenshot
attached to a support request, or an export you choose to share.

## 2. What is held

**About your staff.** Name, email address, which workshop they belong to, and
what they are permitted to do. A password is never stored — only a value derived
from it that cannot be turned back into the password.

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
| Anyone else | Nothing. |

> **To decide.** A named subprocessor list. It cannot be written until hosting
> is chosen, and a council will ask for it by name. Owed before any contract.

## 5. How long it is kept

| What | How long |
| --- | --- |
| Your workshop's records, while you are a customer | Indefinitely — they are your books |
| After you stop | A return window, then removed. **To decide: the length.** Long enough that a workshop coming back does not find its history gone |
| Accounting records | Seven years is the working assumption for this market. **To decide: confirm with an accountant or a council before publishing a figure** |
| Hand-off files MOTION keeps its own copy of | Configurable per workshop, defaulting to seven years |
| Audit trail | For the life of the workshop's account. Removing it would defeat its purpose |

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

> **To decide.** A notification window in hours, written into the contract.
> Common practice is 72; do not commit to a number that cannot be met at
> current staffing.

## 9. Transfers

On the hosted service, data is held wherever the platform is hosted. **No
platform has been chosen yet**, so no country can be stated. A council with a
data-residency requirement should raise it before contract, not after — it is a
constraint on where MOTION is hosted for that client, and it is satisfiable.

On an installed site the question does not arise: the data is on your hardware
and does not leave it.
