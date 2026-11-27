# Going live

The plan for the fortnight around a go-live: what will be tested, what
"working" means, the order of the switch itself, what happens if it goes
wrong, and who to ring when it does.

One document rather than four, because it is one week and one set of people.
Sign the acceptance section at the end; the rest is the work leading to it.

**Fill in the bracketed values per client.** Everything else is the same every
time.

---

## 1. Who is doing what

| Role | Who | Responsible for |
| --- | --- | --- |
| Workshop sponsor | *[name]* | Says yes. Settles disputes about scope. Signs acceptance |
| Workshop lead | *[name]* | Day to day. Answers questions about how the workshop actually runs |
| Data owner | *[name]* | The source files, and whether the imported figures are right |
| IT contact | *[name]* | Server, network, the drop folder, backups |
| MOTION lead | *[name]* | Configuration, import, training, the switch |

A go-live with no named sponsor slips. The person who can say "that is out of
scope, we will do it next month" is the one who makes the date.

## 2. Before anything is installed

- [ ] Sponsor and leads named above.
- [ ] Go-live date agreed, and it is **not** month-end, not a Friday, and not
      the week the workshop is busiest.
- [ ] Source data identified and exportable — customers, vehicles, products,
      suppliers, and outstanding balances.
- [ ] Chart of accounts agreed with the bookkeeper if the accounting hand-off
      is in scope. *This is the item that most often turns up late.*
- [ ] Tax rate, currency and timezone confirmed.
- [ ] Logo and letterhead details supplied.
- [ ] **Installed sites only:** server meets requirements, drop folder exists
      and is writable.
- [ ] Off-site backup configured: a bucket, and a key pair whose private half
      is held by the client **off the server**, in two places. See
      `ops/backup/README.md`. *Commissioning is not complete until a restore
      has been run and passed — step 7 below.*
- [ ] Support contacts exchanged both ways.

### An organisation with its own fleet

On the Fleet and multi-site plan, the setup is the organisation's own
hierarchy. Collect it on paper first; it is the part that takes longest to
agree, and nothing in the fleet route works until it is in.

- [ ] **Units and workshops.** Every division, every workshop and bay, and the
      check bay and reception points, named as the organisation names them
      (Settings → Workshops and bays).
- [ ] **Staff per workshop.** Who works where, as mechanic, artisan or intern.
      A person may be on more than one (Settings → Workshops and bays).
- [ ] **Appointments.** The foreman and deputy of each workshop, the divisional
      head of each unit, and the fleet coordinator (Settings → Organisation).
- [ ] **Requisition rules.** The value limit, who approves above it, and how
      many quotations a purchase needs at each value (Settings → Requisition
      rules). Copy them from the organisation's own procurement policy; a
      South African municipality's may be stricter than the national bands.
      MOTION compares values **excluding VAT**, and the law's thresholds
      include it: enter each limit as its VAT-exclusive equivalent.
- [ ] **Pay numbers and designations** on every person who signs a job card or
      a requisition. They are printed beside the signature.
- [ ] **Departments as customers.** Each department that sends vehicles, with
      its cost centre, so the job card and the requisition name who pays.
- [ ] **The floor app on the mechanics' phones.** The link is
      `https://motionworkshopmanager.com/<workshop>/pwa` (or the installed
      site's address). Each mechanic signs in once and adds it to the home
      screen; the staff guide's *Supporting an organisation with its own fleet*
      covers what to tell them.

## 3. Testing, before it is anybody's real work

Run against real data in a copy, by the people who will use it — not by MOTION
demonstrating it. Somebody watching a demonstration learns nothing about
whether their own Friday works.

Each row is pass or fail. A fail is written down with what happened, not
discussed and forgotten.

### The money path — the one that must not be wrong

| # | What is done | What must be true |
| --- | --- | --- |
| 1 | Raise a quote for a real job | Prices and tax match what the workshop would have quoted on paper |
| 2 | Convert it to a job card | Nothing retyped. The same document |
| 3 | Add parts and labour | Stock on hand falls by what was used, once processed |
| 4 | Process to an invoice | Total, tax and rounding match the old system to the cent |
| 5 | Send it to a customer | Arrives by WhatsApp or email. Opens. Readable on a phone |
| 6 | Take a part payment | Outstanding balance is right |
| 7 | Take the rest | Document closes on its own |
| 8 | Credit one of them | Reverses correctly. Stock comes back |
| 9 | Void a processed invoice | Keeps its number. Re-opens what it settled |

### The books

| # | What is done | What must be true |
| --- | --- | --- |
| 10 | Run the debtors report | Total matches the old system's, or the difference is explained and accepted |
| 11 | Run the tax summary for a period | Ties to what would have been declared |
| 12 | Run the number sequence report | Every number accounted for; any gap explained |
| 13 | Export the accounting file | Imports into the finance system without manual editing |
| 14 | Confirm the receipt leg | The `.ok` file appears and the run shows confirmed |

### Everyday use

| # | What is done | What must be true |
| --- | --- | --- |
| 15 | Book a job in the diary | Appears where expected |
| 16 | A mechanic clocks on and off | Hours land on the job |
| 17 | Go offline on the floor app, clock, come back | Events arrive once, not twice |
| 18 | Receive a supplier invoice against an order | Stock in, and the amount owed is right |
| 19 | Count a shelf and apply it | Adjustment posts against the ledger, not the sheet |
| 20 | A role that may not see cost signs in | No costs, no margins, no contact details — including in exports |

### Migrated data

| # | What is done | What must be true |
| --- | --- | --- |
| 21 | Count customers, vehicles, products | Matches the source file, or the difference is explained |
| 22 | Spot-check twenty records against source | Fields in the right columns, nothing truncated |
| 23 | Check opening balances | Total owed matches the old system |
| 24 | Search for a customer by phone and by plate | Found both ways |

### The fleet route — organisations with their own fleets only

Run one real vehicle through every step, with the people who hold each
appointment doing their own part on their own sign-in.

| # | What is done | What must be true |
| --- | --- | --- |
| 25 | Reception opens a job card and sends the vehicle to the check bay | The check bay is told; the vehicle shows as on its way |
| 26 | The check bay receives it, inspects, and sends it to a workshop with a note | The foreman and deputy of that workshop are told; the note travels with it |
| 27 | The foreman assigns two mechanics | Both are told; the first is the lead and is printed as the job card's mechanic |
| 28 | A mechanic opens the job in the floor app, clocks on, and stops for parts | Time lands on the job; the job card shows Waiting for parts |
| 29 | A stores requisition is raised for the parts and signed by each appointment in turn | Each signer is told when it waits for them; the over-limit approver only above the limit |
| 30 | The part the shelf cannot meet becomes a purchase requisition with quotations | Quotations attach; the chosen supplier is recorded with the reason |
| 31 | The mechanic stops with "My part is done"; the foreman sends the vehicle to the quality check | The foreman is told the work is done; the quality check is told it is on its way; a failed check returns it to the workshop that did the work |
| 32 | Reception receives it and the department collects | Every signature is on the printed job card, with names, designations and pay numbers |
| 33 | Replace a foreman with their deputy, then end an assignment | New notifications go to the new person; signatures already given stay on the record |

## 4. The switch

Agree a **stop line**: the moment after which the old system is read-only. Two
systems running side by side for a week is how a workshop ends up with jobs in
one and payments in the other.

**The week before**
- [ ] Full import rehearsed on a copy. Timed, so the real one is predictable.
- [ ] Everyone who will use it has signed in once and changed their password.
- [ ] Training done. Quick-reference sheets at the counter and on the floor.
- [ ] Old system's reports printed or exported for the last full period.

**The day**
- [ ] Final export from the old system, after the last job of the day.
- [ ] Old system to read-only. Tell everybody, in the room.
- [ ] Import. Verify counts against rows 21 to 24 above.
- [ ] Open balances entered and reconciled.
- [ ] Raise one real job end to end and take a payment on it.
- [ ] Sequence numbers set so they continue rather than restart.
- [ ] Backup taken, and **restored** — `ops/backup/motion-verify.sh`, which
      restores the night's backup into a scratch database and checks the data
      and the tenant policies came back. Note the time it reports: that is this
      site's recovery time, and it is the number to quote rather than a
      generic one. Then agree how often the drill is repeated, and by whom: it
      needs the private key, so it runs where the key is kept, not on the
      server.

**The first week**
- [ ] Someone from MOTION reachable at short notice each morning.
- [ ] Debtors total checked daily against expectation.
- [ ] First accounting export run and confirmed by the finance system.
- [ ] Questions collected. The ones that recur become help pages.

## 5. If it goes wrong

Decide **before** the day which of these applies, and who has the authority to
call it.

| Situation | What happens |
| --- | --- |
| Import is wrong but the day can proceed | Carry on. Correct in place; nothing is lost and documents can be edited while draft |
| Import is materially wrong | Stop. Old system back to read-write, work the day on it, re-import that night. Cheap on day one, expensive on day five |
| MOTION unavailable, data intact | Work on paper for the hour and enter afterwards. The document spine is built so a job card raised late is no different from one raised on time |
| A figure is wrong in a way nobody can explain | Stop invoicing from MOTION until it is understood. **Never invoice from a total you cannot account for** |
| Upgrade goes wrong | Roll back to the previous image tag. If a migration has run, the database is restored to match — this is why the backup is tested before the switch, not after |

The rollback window is the first full period. After a month's invoices and
payments are in MOTION, going back means re-keying them, and the answer is to
fix forward.

## 6. Who to ring

| Severity | Means | Route | Response |
| --- | --- | --- | --- |
| **1 — Stopped** | Cannot invoice, cannot take money, nobody can sign in | Phone. Say "severity one" in the first sentence | Immediately, within support hours |
| **2 — Wrong** | A figure does not add up, an export will not import | WhatsApp or email with a screenshot and the document number | Same working day |
| **3 — Blocked** | One person cannot do one thing; a workaround exists | Email | Next working day |
| **4 — Question** | How do I…, can it… | The help library first, then email | As available |

**On an installed site, severity 3 and 4 go to the site's own administrator
first.** A forgotten password is answered in thirty seconds by the person down
the corridor and in two days by a vendor in another town.

Escalation if a severity 1 is not answered: *[second contact]*, then
*[sponsor]*. Fill these in at signing; a matrix with one name is not a matrix.

## 7. Acceptance

Signing says the tests in section 3 were run by the workshop's own people
against its own data, and passed or had their failures accepted in writing.

It does not mean there will be no more questions, and it does not start or stop
support.

Outstanding items accepted at go-live, to be resolved by the date given:

| Item | Owner | By |
| --- | --- | --- |
| | | |

| | Name | Signature | Date |
| --- | --- | --- | --- |
| Workshop sponsor | | | |
| MOTION | | | |
