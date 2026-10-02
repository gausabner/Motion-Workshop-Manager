# Registration, payment and activation

How a workshop becomes a paying client of **MOTION Dynamic Systems**, and how
MOTION's own staff turn a bank deposit into access.

Written because of what happens today: a stranger can reach `/register`, create
a workshop, and be inside the dashboard before anybody has asked them for
money. That is not a bug in any one file — nothing in the product has ever had
an opinion about billing. This document is that opinion, before it is code.

---

## 1. What exists today

`registerAction` in [`web/src/lib/auth/actions.ts`](../web/src/lib/auth/actions.ts)
does the whole thing in one transaction: create the user, create the tenant,
make them `OWNER`, write the tenant defaults, open a session, redirect to the
dashboard. `Tenant.isActive` defaults to `true`.

So the gate does not exist. What *does* already exist, and is worth knowing
before designing anything, is the **lock**: `isActive` is checked in eight
places — session resolution, the customer portal, public booking, public
inspections, team invitations, the sites list, and the password reset. A tenant
with `isActive = false` is already shut out of the entire product.

That is most of the hard part, already built and already tested.

## 2. The flow, as decided

```
register → choose a plan → reference issued → bank deposit or transfer
         → proof uploaded → MOTION staff confirm → access granted
```

Card payments are explicitly **out of scope for now**. The design should not
make them awkward later, which mostly means recording *how* a payment arrived
rather than assuming there is only one way.

## 3. The first trap: `isActive` is the wrong gate on its own

Set `isActive = false` at registration and the new client gets a **404**.
[`session.ts`](../web/src/lib/auth/session.ts) calls `notFound()` for an
inactive tenant, which is correct for a workshop that has been shut down — it
should not even confirm it exists — and badly wrong for a customer who has just
paid and is waiting.

So a tenant needs a *status*, not a boolean:

| status | What it means | What the owner sees |
| --- | --- | --- |
| `PENDING_PAYMENT` | Registered, no confirmed payment | The holding page: reference, amount, bank details, upload proof |
| `ACTIVE` | Paid and confirmed | The product |
| `PAST_DUE` | Was active, renewal unpaid | The product, **read-only**, with a banner — see §9 |
| `SUSPENDED` | Shut off deliberately | 404, as today |
| `CANCELLED` | Gone | 404, as today |

`isActive` stays as the single thing the eight call sites test, derived from
status, so none of them change. Only the two statuses that need a *page* rather
than a closed door get special routing. Keeping the existing boolean as the
derived value is deliberate: a new enum that eight call sites have to be updated
to understand is eight chances to miss one, and a missed one is a tenant
boundary that silently stops being enforced.

## 4. The second trap: MOTION staff have to see across tenants

Every table carrying a `tenantId` has **FORCE row-level security**, and the
application connects as a `NOBYPASSRLS` role. That is the most valuable
guarantee in the product. An admin panel that lists every workshop's
registration is, by construction, the one thing the database is configured to
refuse.

Three ways out, and only one of them is safe:

1. **Unscoped tables with no policy.** Simplest, and wrong. Any query path
   anywhere would then return every workshop's billing record, and the failure
   is invisible — exactly the class of mistake the RLS work exists to prevent.
2. **Connect as a second, privileged role for the admin area.** Workable, but it
   puts a `BYPASSRLS` connection string inside the web application, where a
   single mis-routed query reaches everything.
3. **A second session variable, recommended.** Mirror the existing
   `announceTenant` pattern with `motion.platform_admin`:

   ```sql
   CREATE POLICY platform_or_tenant ON "Subscription"
       USING (
           "tenantId" = NULLIF(current_setting('motion.tenant_id', true), '')
           OR current_setting('motion.platform_admin', true) = 'on'
       );
   ```

   The policy still binds the table owner. The flag is set only by an
   `announcePlatformAdmin()` helper called after the request has been proven to
   belong to MOTION staff, and only on the billing tables — never on a
   workshop's customers, documents or payments. MOTION staff confirming a
   deposit have no business reading a workshop's invoices, and the database
   should enforce that rather than trusting the admin UI not to offer it.

This is the single most important decision in the document, and the one most
worth getting wrong slowly.

## 5. Schema

Plans stay in code. [`lib/pricing/plans.ts`](../web/src/lib/pricing/plans.ts) is
already the single source for the pricing page, a proposal and what a
salesperson says out loud, and moving it into the database would mean three
places again. What goes in the database is **what this client agreed to pay**,
snapshotted — the same rule the codebase already applies to tax on a document:
a price that re-reads itself from the current price list silently rewrites
history when the price list changes.

```prisma
model Subscription {
  id            String   @id @default(cuid())
  tenantId      String   @unique
  planId        String            // "workshop" | "full" | "council"
  planName      String            // snapshot, so a renamed plan reads correctly
  priceAmount   Decimal  @db.Decimal(12, 2)   // snapshot, excluding VAT
  currency      String   @default("NAD")
  period        BillingPeriod     // MONTHLY | QUARTERLY | ANNUAL
  status        SubscriptionStatus
  reference     String   @unique  // what the customer puts in the bank reference
  startedAt     DateTime?
  periodEndsAt  DateTime?
  createdAt     DateTime @default(now())
  payments      SubscriptionPayment[]
}

model SubscriptionPayment {
  id              String   @id @default(cuid())
  subscriptionId  String
  tenantId        String            // for the policy in §4
  method          PaymentMethodKind // BANK_DEPOSIT | BANK_TRANSFER | CARD (later)
  amount          Decimal  @db.Decimal(12, 2)
  declaredAt      DateTime          // when the customer says they paid
  confirmedAt     DateTime?         // when MOTION confirmed it
  confirmedById   String?           // which staff member — answerable
  note            String?
  createdAt       DateTime @default(now())
}
```

**Proof of payment reuses `Attachment`** with `ownerType = "SubscriptionPayment"`.
That is not a shortcut: the storage layer already records which driver wrote
each file, so proofs follow the same local-disk-to-bucket path as everything
else, and the EFT proof-of-payment flow a workshop uses for *its* customers is
the same shape. One upload path, already tested.

## 6. The reference number

This is the join between a bank statement and a database row, and it is the
thing most likely to go wrong operationally.

- **Unique across the platform**, so the existing `Sequence` model cannot be
  used — it is tenant-scoped, and two workshops would be issued `0001`.
- **Short enough to survive a bank's reference field**, which truncates without
  telling anybody. Ten characters or fewer.
- **Unambiguous when read off a screen and typed into online banking.** Drop
  `O/0`, `I/1`, `S/5`, `B/8` from the alphabet. A reference nobody can
  transcribe is a payment nobody can match, and matching is manual here.
- Format: `MOT-7KQX4F` — fixed prefix so MOTION's own staff recognise it on a
  statement at a glance, six random characters from the reduced alphabet.

It is shown on the confirmation page **and** emailed, because the one thing
worse than a wrong reference is a reference the customer no longer has.

## 7. What the customer experiences

1. **`/register`** — as today, but the tenant is created `PENDING_PAYMENT` and
   the redirect goes to the plan chooser rather than the dashboard.
2. **Choose a plan** — the three tiers from `plans.ts`. `council` has no price,
   so it routes to "we will quote you" and a staff conversation, not a
   reference.
3. **Confirmation page** — amount including VAT if applicable, the reference,
   MOTION Dynamic Systems' bank details, and an upload box for the proof.
4. **Email, immediately** — the same details. This is the one that matters: the
   person who registers is often not the person who pays.
5. **Returning before activation** — any `/[tenant]/…` URL lands on the holding
   page, not a 404. It shows where the registration stands, the reference again,
   and lets them upload a proof if they have not.
6. **Email on activation** — "you are in", with the sign-in link.

Steps 3–6 should carry a progress indicator, for the same reason the password
reset does: the journey crosses an email client and a bank, so the customer
leaves and comes back with no memory of where they were.

## 8. The admin panel

A new area for MOTION staff, not a workshop feature.

- **Who gets in.** A `User.isPlatformStaff` flag, set by hand in the database to
  begin with. Not a group on a membership — MOTION staff are not members of a
  customer's workshop, and modelling them as one would give them a seat inside
  somebody's business.
- **Where.** `/admin`, which must be added to `RESERVED_SLUGS` so no workshop
  can register that address. Worth checking the other reserved names cover
  `billing` and `register` too.
- **What it does.** List registrations by status; open one; see the plan, the
  amount, the reference and the uploaded proof; record the payment as confirmed;
  activate the tenant. Deactivate and suspend as well, because the panel that
  can grant should be the panel that can revoke.
- **Every action audited** — who confirmed what, when. `AuditEvent` exists but
  is tenant-scoped; platform actions need their own trail, because the question
  being answered later is "which of our staff granted this access", and that is
  MOTION's record, not the workshop's.

This is the most dangerous surface in the product. It should be built last,
deliberately small, and reviewed harder than anything else here.

## 9. Renewals, which is where this gets expensive

Monthly billing by bank deposit means **twelve manual reconciliations per
client per year**. At twenty clients that is 240 deposits a year to match by
hand, and the failure mode is a paying customer locked out because nobody
checked the statement on a Friday.

Recommendation: make **annual the default** with a visible discount, offer
quarterly, and allow monthly only where asked. It is less cash-flow pretty than
monthly, but it cuts the reconciliation burden by a factor of twelve at exactly
the moment there are no staff to absorb it. Revisit when cards arrive, which is
the real fix.

`PAST_DUE` exists in §3 for this reason, and what it does is **already
committed to in the terms of service**, which is a stronger constraint than my
preference:

> "You get a grace period. After it, MOTION becomes read-only: you can still see
> everything, still print, still export, still get your books out. You cannot
> raise new documents until the account is settled."
>
> "We do not lock a workshop out of its own floor… Cash flow here is seasonal and
> a workshop that cannot invoice cannot pay us either."

So `PAST_DUE` is **not** the holding page. It is the full product with writes
refused on new documents and a banner saying why. An earlier draft of this
document had it falling back to the holding page, which would have broken a
published promise — worth recording, because the terms are the specification
here and the schema has to follow them rather than the reverse.

Read-only is also more work than a closed door, and that cost is already
agreed.

## 10. The demo path

The ask is "whether looking to pay or to explore a demo", and these pull in
opposite directions — the point of the gate is that nobody uses MOTION without
paying.

Three options:

| | What it costs to build | What it risks |
| --- | --- | --- |
| **Staff-led demo** (today's CTA: "Book a demo" → `/support`) | Nothing. Already built. | Every prospect needs a human. Doesn't scale past a few a week. |
| **Self-serve trial tenant**, 14 days, seeded with sample data | Moderate: seeding, expiry, conversion | A trial that can WhatsApp real customers, or print an invoice with no "DEMO" on it, damages the brand in a small market |
| **Read-only tour** of a pre-built demo workshop, no registration | Low–moderate | Convinces less than driving it yourself |

**My recommendation, which is a business call rather than a technical one:**
keep the staff-led demo for now and ship the paid path first. The market
document's own reasoning applies — a trial nobody can convert is worse than no
trial — and with one live client the bottleneck is not demo throughput.

But I would flag the counter-argument honestly: a N$1,200/month ask, paid by
bank deposit, with no way to try it first, is a high bar for a two-bay workshop
in Windhoek, and the real competitor here is paper. If conversations stall at
"can I see it first", the trial moves up the list. If a trial is built, it must
be unable to message real customers and must mark every PDF.

## 10a. Decisions taken

| Question | Answer |
| --- | --- |
| Demo path | **Staff-led only.** No trial, no tour. "Book a demo" → `/support` stays as it is |
| Billing period | **Monthly.** Chosen against the recommendation in §9, knowingly — so §9's mitigations are not optional: renewal reminders, a real grace period, and an admin list ordered by what is due |
| One-off registration fee | **None.** One amount, one reference: the first month's subscription |
| VAT | **Registered.** Omzizi Investment CC, VAT `06658872-015`. 15 % is added, and what MOTION sends is a tax invoice a workshop can claim against |

**The VAT answer was given as "not registered", then corrected by evidence.**
A quotation from the operating company shows a VAT registration number and a
15 % line on the total, so the answer is yes. Both versions of the copy have now
been written, which is worth recording rather than quietly tidying away:

- Answered "not registered", I changed the pricing page and the terms to say no
  VAT is charged and nothing is a tax invoice.
- Shown the quotation, that is reversed. 15 % is charged, the VAT number is
  published, and the invoice is a tax invoice.

The reversal matters because the wrong version was the more dangerous one. A
workshop told "no VAT is charged" on an invoice that *did* charge it cannot
reclaim the 15 % it paid, and a customer told the opposite reclaims tax that was
never charged. Either way the error lands on their return, not ours. The lesson
is narrow and worth stating: a tax status is a fact to be evidenced, not a
preference to be asked about.

The copy now says prices are quoted excluding VAT, names Omzizi Investment CC
and its VAT number, states that 15 % is added, and spells the arithmetic out —
N$1,200 a month is N$1,380 paid — because a customer meeting the 15 % for the
first time at the bank is a complaint, not a surprise.

That is legal copy and it needs your sign-off, not mine.

Nothing here touches the 15 % the product applies to a workshop's own invoices.
That is their VAT on their work, and it is unaffected — the two rates are
separate constants on purpose, so a workshop changing its own rate cannot move
what MOTION charges.

## 11. What I still need from you before building

| | Why it blocks |
| --- | --- |
| **Which accounts are MOTION staff** | `isPlatformStaff` has to be set for somebody, or nobody can activate anyone |
| **Sign-off on the amended terms** | §10a. I have changed what the terms say about tax, twice. That should not rest on my judgement |

### Supplied

**The entity.** The contracting party is **Omzizi Investment CC**, trading as
Motion Dynamic Systems — registration `CC/2014/11996`, VAT `06658872-015`,
Office II – 435 Ellis Street, Windhoek North, Windhoek, with a second office in
Oshakati West and a postal address at P.O. Box 630, Oshakati West. Now filled
into `LEGAL_ENTITY`, which existed for this and had `registered: false`.

The brand is not the party. "Motion Dynamic Systems" appears on no register and
could neither be sued nor paid, so the registered name leads everywhere it
matters and the trading name follows it.

**The bank details**, as configuration rather than constants
(`BILLING_BANK_*`): First National Bank, branch `280475`, account
`64283593331`. Out of the repository because an account number shown to
customers is the highest-value line in that file to an attacker — change it and
payments go elsewhere silently, with the first symptom being a customer
insisting they paid — and because an installed edition at a council does not
bill through Omzizi at all.

**A reference convention already in use.** The supplied quotation carries
`Payment Reference 0428726T CN-003T`, so references against deposits are
existing practice rather than something being introduced. §6 should stay close
to that habit instead of inventing a competing scheme.

## 12. Phasing

**Phase 1 — stop giving it away, and be able to take money.** Tenant status,
the holding page, the plan chooser, the reference, the confirmation page and the
two emails. Activation done by hand in the database by whoever has SSH. Ugly,
honest, and it closes the hole this week.

**Phase 2 — the admin panel.** `isPlatformStaff`, the `motion.platform_admin`
policy from §4, the registration list, proof viewing, confirm-and-activate, and
the platform audit trail. Phase 1's manual step disappears.

**Phase 3 — renewals.** `periodEndsAt`, the reminder email, `PAST_DUE` and the
grace period.

**Later — cards.** `PaymentMethodKind` already has room for it. Nothing in
phases 1–3 should assume a bank deposit is the only way money arrives.

---

## What this does not cover

- **Invoices from MOTION to its clients.** A client paying N$1,200 a month will
  want a tax invoice, and councils will insist. The product can already render
  PDFs; this would be MOTION's own books rather than a workshop's, which is a
  different ledger and arguably a different system.
- **Dunning.** What actually happens on the third unpaid month is a business
  policy, not a schema.
- **Proration and plan changes.** A workshop moving from Workshop to Full
  mid-period needs an answer. Not one worth inventing before anybody asks.
