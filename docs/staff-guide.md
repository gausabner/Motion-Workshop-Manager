# MOTION staff guide

For the team at Motion Dynamic Systems who approve new workshops, record
payments and look after accounts. Everything here happens at
**motionworkshopmanager.com/admin**.

## Getting in

1. Register a normal MOTION account, or use the one you already have.
2. Ask whoever runs the server to make you staff:

   ```bash
   ssh motion-root /opt/motion/ops/server/motion-grant-staff you@example.com
   ```

   `--list` shows who is staff; `--revoke you@example.com` removes access.
3. Sign in and go to `/admin`. Anybody who is not staff gets "page not found"
   there — the page does not admit it exists.

## What lands in the info@ inbox

| Email | When | What to do |
| --- | --- | --- |
| **New registration MOT-XXXXXX — Workshop** | A workshop signs up and picks a plan | Watch the bank statement for that reference |
| **Renewals: 2 reminded, 1 now read-only** | 07:00 each morning, only if something is due | Watch the statement for those references |

Customers send proof of payment to info@ as well. The reference on a proof of
payment is what you search for on `/admin`.

## The page, top to bottom

- **Waiting on payment** — new registrations. Oldest first.
- **Renewals due** — paying workshops whose date is within a week, past due, or
  read-only. Soonest first: read the bank statement in this order.
- **Registered, no plan chosen** — signed up before plans were part of the form.
  They choose a plan at `/activate`; nothing to approve until they do.
- **Active** — everyone paid up, with the date they are paid up to.
- **Suspended and cancelled** — switched off. Nothing is ever deleted.
- **Recent staff activity** — every action on this page, with who did it.
  "MOTION (automatic)" is the morning run.

**Search** takes a reference however the bank printed it — `mot y4 lgp9`
finds `MOT-Y4LGP9` — or a workshop name, its web address, or the owner's email.

## Everyday tasks

### A new workshop has paid

1. Search the reference from the statement.
2. Check the amount matches (the page shows it including VAT).
3. **Payment received** → **Yes — switch it on**.

The workshop goes live, is paid up for one month from today, and the owner is
emailed with its tax invoice attached. The payment is recorded with your name
on it.

### A renewal has been paid

1. Search the reference. It is under **Renewals due**.
2. **Payment received** → **Yes — record it**.
3. The button is replaced by what happened: "paid up to …, tax invoice … is on
   its way to the owner". That is the confirmation — there is nothing more to
   press.

A workshop that pays **early** — while it is still paid up for weeks — is not
in Renewals due and has no Payment received on the list. Click its name and
use **Record an early payment**, which names the exact period it buys. A
second payment for the same workshop within ten minutes is refused as a
probable repeat click.

The date moves on one period and the owner gets a receipt with its tax invoice
attached. How far it moves:

- **Paid early, on time, or within the grace week** — the month continues from
  where it was paid up to. Paying a few days late does not shift their date.
- **Was read-only or suspended** — the new month starts today. They are not
  charged for time they could not fully use.

If somebody else already recorded it, the page says so and nothing is doubled.

### Someone has not paid

Nothing to do. MOTION handles it, on a timetable the terms of service promise:

| Day | What happens |
| --- | --- |
| 7 days before due | Owner emailed: amount, bank details, reference, and the read-only date |
| Due date | Grace week starts. Everything still works; the owner sees a warning |
| 7 days after due | **Read-only.** Owner emailed. Everyone can still sign in, see, print and export — only new quotes, job cards and invoices are paused |

Read-only lifts the moment you record their payment.

### Suspend a workshop

For an account that has stopped paying and stopped answering. **Suspend** →
**Suspend workshop**. Nobody there can sign in; they see a page saying access
is paused, their data is safe, and how to pay. The owner is emailed the same.

When they pay, find them under **Suspended** and use **Payment received** —
that restores access and starts a new month. **Switch back on** restores access
*without* a payment (a suspension made by mistake); if their date has passed
they go read-only again the next morning.

### A workshop that was live before billing existed

It shows "No billing set up". Use **Set up billing**: choose the plan, confirm
the monthly amount (excluding VAT — change it for a negotiated price), how
often it renews, and the date it is **already paid up to**. No payment is
recorded; renewals run from that date. The workshop gets its own reference,
shown on its Billing page.

### Correct a date

**Change date** — for a payment arranged another way, a month given free, or a
date set wrongly. Moving it later lifts read-only if the new date puts them
back in good standing. To record money that arrived, use **Payment received**
instead, so it appears in their payment history.

### A late payer asks for a few more days

**Lift read-only** gives them full access back without a payment, until the
next morning's run (07:00), when they go read-only again and are emailed again.
For longer, **Change date** to the date they have agreed to pay by.

## Tax invoices

Every payment you record issues a **tax invoice** from Omzizi Investment CC,
trading as Motion Dynamic Systems, at the same moment: numbered `MWM-00001`,
`MWM-00002` and so on with no gaps, showing the VAT separately, marked paid.
It is attached to the owner's email automatically.

- **Find one:** click the workshop's name on `/admin`. Its page lists every
  payment with its invoice — click the number for the PDF — and whether it
  was emailed.
- **"Not emailed yet":** the email did not go (a mail problem, or no owner on
  file). Use **Send** once it is fixed. **Send again** is for "I never got it".
- **The workshop's own copy:** owners and admins see every invoice under
  Settings → Billing in MOTION.
- **Their details are wrong on it:** an invoice is addressed from the
  workshop's company profile *as it was when issued*. If the workshop page
  warns that the address or VAT number is missing, ask the owner to fill in
  Settings → Company profile — it applies from their next invoice.
- **A payment recorded by mistake:** open the workshop's page and use
  **Reverse** on the newest payment, with a reason — it is printed on the
  credit note. A **tax credit note** (`MWM-CN-00001` and on) cancels that
  invoice in full and is emailed to the owner, and the paid-up-to date goes
  back to where that payment started. Payments are reversed newest first; the
  next one along then offers **Reverse** too. The invoice and the payment stay
  on the record, marked cancelled and reversed — nothing is deleted.

### A workshop that paid before MOTION recorded payments

A workshop switched on before payments were recorded — approved before
8 October 2026 — has no payment and so no invoice. Its page offers **Record a
payment already received** for the period it is in now. Use it **only if the
money really arrived** — it issues a real tax invoice, which is a declaration
of VAT. If the workshop was a test, leave it.

## What you cannot see

Each workshop's plan, amount, reference, dates and owner's contact details —
nothing else. Not their customers, vehicles, jobs, invoices or money. That is
enforced by the database, not by the page, and it is tested.

## When something looks wrong

| You see | It means |
| --- | --- |
| Amber "No bank details are configured" at the top | The server is missing `BILLING_BANK_*`; customers are not being told where to pay |
| A deposit with no reference | Search the payer's name or business name. If you cannot match it, do not guess — ask the bank for the depositor's details, or wait for the proof of payment to arrive at info@ |
| The amount paid is wrong | Do not record it. Contact the owner; record it once the full amount is in |
| No morning email for days | Normal if nothing is due. To check the run itself: `ssh motion-root /opt/motion/ops/server/motion-renewals` prints what it did; it is safe to run any time |
| "is no longer in a state where that applies" | Somebody else acted first. Refresh |

## Settings the server owner can change

In `/etc/motion/motion.env`, then `systemctl restart motion`:

- `BILLING_NOTIFY_EMAIL` — where the team emails go (info@ today).
- `BILLING_REMINDER_DAYS` and `BILLING_GRACE_DAYS` — both 7 unless set.
- `BILLING_TICK_SECRET` — what the morning run uses to reach the app. Unset,
  nobody is reminded and nobody goes read-only.
- `BILLING_INVOICE_PREFIX` — the letters in front of invoice numbers, `MWM-`
  unless set. Decide before the first real invoice; changing it later starts a
  visibly different series.
