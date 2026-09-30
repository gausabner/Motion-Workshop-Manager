# Connecting MOTION to your systems

For the IT manager or finance system owner asking how MOTION will talk to
SOLAR, Sage, SAP, Odoo or whatever the council already runs.

The short answer: **MOTION pushes outward, and nothing ever reaches in.**

Last reviewed 30 September 2026 against the shipped code.

---

## 1. The rule everything else follows from

No integration requires your network to accept an inbound connection. There is
no port to open, no VPN to build, no agent waiting for instructions, and no
account for us on your systems.

That is not a limitation dressed as a principle — it is the only arrangement a
council's network team will sign, and building every integration to fit it is
cheaper than arguing the point per deal.

```
  MOTION (on your LAN) ──nightly──► a folder ──► SOLAR / Sage / SAP / Odoo
                            ▲                              │
                            └────── a receipt file ────────┘
```

## 2. The nightly journal

Each night MOTION writes the day's journal into a folder that your accounting
system collects on its own schedule.

**What is in it.** Sales, the tax charged on them, receipts from customers,
supplier invoices and payments to suppliers — as balanced journal batches, each
carrying its own reference, `MOTION-SALES-2026-09-24` and so on.

**It balances before it leaves.** The journal is checked batch by batch, not
only in total. A file where sales are out by fifty and purchases are out by
fifty the other way has correct totals, imports cleanly, and costs an accountant
an afternoon in March — so a file that does not balance is not written at all
and the run is recorded as failed with the reason.

**A repeat cannot post the day twice.** Each run is recorded against workshop,
kind, shape and period before a byte is written. A schedule that fires twice — a
retry, a clock change, somebody pressing the button after cron already ran —
finds the existing record and stops.

**A quiet day writes nothing.** A day with no trade is recorded as a successful
run that produced no file, rather than a file of headers your system imports
every Sunday. The distinction matters: it means a missing file is a missed run
rather than a quiet day, and the screen can tell you which.

### The shapes

The same journal, projected into whichever column order the receiving system
wants. Nothing is recalculated between them, so switching packages cannot change
the figures.

| Shape | Columns |
| --- | --- |
| **Plain** | Date, Reference, Account, Description, Debit, Credit |
| **QuickBooks** | JournalNo, JournalDate, Account, Debits, Credits, Description, Name |
| **Sage Evolution** | Reference, Date, AccountCode, Description, Debit, Credit, TaxType |
| **Xero** | Narration, Date, Description, AccountCode, Amount, TaxRate |

Dates are day-first for QuickBooks and Sage because those imports insist on it,
and ISO everywhere a person might read the file.

**Confirm the columns against your own installation before the first live run.**
Sage Evolution's import layouts are defined per installation and QuickBooks has
changed its journal columns between releases. The headers live as configuration
rather than being welded into the code, so a mismatch is a change of map rather
than a change of software.

### The account codes

MOTION posts to seven codes, which come from your chart of accounts, not from
MOTION: debtors, sales, output tax, bank, creditors, purchases and input tax.
They are entered once in Settings and are the thing to agree with the bookkeeper
before the schedule is switched on. A journal that balances can still be
entirely in the wrong place.

### Where the file lands

A folder path template. `handoff/{tenant}/{yyyy}/{mm}` by default — `{tenant}`
gives a council running four workshops a folder each, leaving it out gives one
shared folder, and the workshop's name is in every filename either way.

The folder is reached through MOTION's storage layer, so it can be a local
mount, a file server, or an S3-compatible bucket your systems already read.

### The receipt leg, and why it matters

When the import succeeds, your side writes a file of the same name with `.ok`
on the end into a receipt folder. MOTION reads it on the next run and marks
that day confirmed.

Its contents are never read — only its existence — so implementing this end is
one line of shell.

This is the part that looks optional and is not. A drop folder that silently
stopped being read produces exactly the same evidence as a working
integration: files written, files present. Without a receipt, the first anyone
learns of a month of failed imports is at year end.

Until a receipt folder is agreed, every run stays *sent, not confirmed* — which
is the honest state, and the Hand-off screen says so rather than showing a tick
nobody earned.

### The schedule

MOTION has no scheduler of its own and deliberately does not grow one: an
in-process timer fires twice when two instances run, not at all while one
restarts, and cannot be set to 02:00 Windhoek by anybody not reading the source.

Instead, whatever your host already has — cron, a systemd timer, a Kubernetes
CronJob, Task Scheduler on the Windows box in the server room — makes one
request:

```bash
curl -fsS -X POST https://motion.example/api/handoff/run \
     -H "Authorization: Bearer $HANDOFF_SECRET"
```

It returns non-zero if any workshop failed, so a cron line ending in `|| mail`
behaves the way its author expects. A named day can be passed to fill in a
missed night without waiting for the date to come round again.

## 3. Everything, as one archive

Independent of any schedule: an owner can download every table as CSV in a
single archive, at any time, with a README explaining how the tables join. Use
it for a data-warehouse load, a migration, or an auditor who wants the lot.

## 4. The REST API

For building against MOTION rather than feeding another ledger: customers,
vehicles, products, bookings and documents over ordinary JSON. Read-and-write,
authenticated by a key that identifies the workshop, rate limited, and
idempotent on your own external identifiers so a retry cannot create a duplicate.

Full reference: [the public API](public-api.md).

Note the direction. The API is *you calling MOTION*, which is outbound from
your side and therefore still requires nothing inbound on your network.

## 5. What MOTION will not do

- Accept an inbound connection into your network.
- Hold credentials for your ERP, or log into it.
- Write directly into your accounting database.
- Expose a public endpoint on an installed site.

If an integration seems to need one of these, it can almost certainly be turned
round into a file MOTION writes and your system collects. That conversation is
worth having before the contract rather than after.
