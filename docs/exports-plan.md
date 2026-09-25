# Exports — what to build, in what order

Planned before building, because the two buyers want opposite files and
conflating them is how workshop software exports badly.

A council auditor wants **evidence**: completeness, immutability, a total that
ties, and a PDF with a page count they can file. An owner wants a **decision**:
what made money, who owes, what is not moving — as CSV, because the next thing
they do is sort it.

Same query either way. They differ in whether the filters travel with the file,
and in whether a PDF is produced beside the CSV.

## Where we stand

| What | Formats today |
| --- | --- |
| Sales, receipts, purchases, supplier payments | CSV — plain, Xero, journal |
| One document / one receipt / a statement | PDF |
| Profit, debtors, creditors, mechanic time | none — screen only |
| Customers, vehicles, products, stock, audit trail | none |

The CSV machinery in `lib/accounting/export.ts` is reused whole: quoting only
where needed, `=`/`+`/`@` defused so a spreadsheet cannot run a cell, CRLF, and
a BOM so Excel does not mangle the first heading. Ten tests hold it. Nothing
below adds a second CSV writer.

## Phase 1 — a council refuses to buy without these

| Export | Format | Data |
| --- | --- | --- |
| Transaction log for a period | CSV + PDF | `AuditEvent`, ready |
| Document number sequence and gaps | PDF + CSV | `Sequence` + states, ready |
| Sales register, filed form | PDF | ready |
| VAT summary for a period | PDF + CSV | tax frozen on the document, ready |
| Cash book by payment method | CSV + PDF | `Payment`/`PaymentTender`, ready |
| Debtors age analysis | PDF + CSV | ready |

Two of these need more than a query. The transaction log must carry the
snapshot taken before a deletion, so it says *what* was deleted rather than
only that something was; and it must be filterable by actor, because the
question is almost always about one person.

The **gap report** is the completeness test and the most likely reason a first
audit goes badly: every number issued, the missing ones flagged, each gap
accounted for as voided, deleted, or unexplained. No benchmark product does
this well, which makes it a differentiator rather than catch-up.

## Phase 2 — what an owner decides with

Profit by job (ranked) · item sales by product, group and supplier · stock
valuation and stocktake variance · mechanic time clocked against charged ·
creditors age · work in progress · customer and vehicle listings · service and
licence renewals due · quote outcomes.

Each is a download button on a screen that already computes the figures. The
work is one shared exporter, then ten thin call sites.

Work in progress doubles as auditor material — it is unbilled revenue at a
period end. The customer listing is the data-portability answer, and for that
reason `redactContact` must apply to the file exactly as it applies to the
screen, or the export becomes the way around the permission.

## Phase 3 — the machine hand-off

Outbound only. MOTION writes a file; the ERP picks it up. Nothing listens and
nothing is exposed, which is the only shape a council network team will accept.

    MOTION (on the LAN) --nightly--> drop folder / SFTP --> SOLAR / Sage / SAP / Odoo
                                            ^                        |
                                            +------ receipt file ----+

The receipt leg matters more than it looks: without it, the first anyone learns
of a month of failed imports is at year end.

1. **Nightly journal drop.** The journal CSV exists and balances already
   (`journalBalances` is tested). New: the schedule, the destination, the kept
   copy, and a screen saying whether it landed.
2. **QuickBooks and Sage Evolution shapes.** Column maps over the same rows.
   Cheap to write; the expensive part is discovering the exact header a given
   site's version wants, which is a per-deal conversation.
3. **Everything, as a bundle.** A ZIP of every table as CSV. The concrete form
   of the promise that a workshop's data is never withheld, and the
   disaster-recovery answer council IT asks for before signing.

Scheduled email reports come last: they need a mail provider MOTION does not
have, and the on-premise buyers asked for a file in a folder.

## Rules for every export

- **Every file says where it came from** — workshop, period, generated-at in
  the workshop timezone, generated-by, row count. CSV preamble, PDF footer.
- **Exporting is an audited act** — who exported what, over which period, how
  many rows, into `AuditEvent` like any other act.
- **Permission follows the screen, and so does redaction** — `can()` gates the
  route as it gates the page; `redactContact` runs before the rows are written.
  No new permission for downloading what you can already read.
- **Nothing unbounded is held in memory** — the transaction log and the bundle
  stream; the PDF variants take a hard row cap with a plain message.
- **CSV for re-adding, PDF for filing** — where both exist they are one query
  rendered twice, so they cannot disagree.

## Decided

- **Phase 1 in full** before anything in phase two.
- **An unexplained gap warns and is recorded**, and does not block a period
  close. The record is what an auditor wants; blocking would be a support call
  every time somebody deletes a draft.
- **The full bundle is owner self-service and audited** — which is the answer
  council IT asks for, not a weaker one.

## Still open

- Council retention — seven years is assumed; confirm before designing the archive.
- Drop folder per tenant, or per council where one council runs several workshops?
