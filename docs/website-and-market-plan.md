# The website, the documents, and getting into the market

*Updated 25 November 2026: wording follows the rule (an organisation with its own
fleet, not a council), the benchmark's prices are corrected, and the three
decisions are made.*

Planned before building, because the expensive mistake here is writing ninety
documents nobody asked for while the one an organisation's procurement actually wants is missing.

## Part one — the two front doors

MOTION has no public surface at all today. `/` redirects to `/login`; the only
pages a signed-out person can reach are the sign-in and registration forms.
Both editions need something in front of that, and they need different things.

| | Cloud edition | On-premise edition |
| --- | --- | --- |
| Who arrives | A workshop owner, on a phone, sent a WhatsApp link | Staff at an installed site; the organisation's IT |
| What they want | To believe this is worth N$ 1,200 a month | To do their job; to find who to ring |
| What must not appear | — | Pricing, sign-up, anything implying a purchase |
| Network | Ordinary internet | Outbound-only, often no internet at all |

One codebase, one flag. `MOTION_EDITION=cloud|onprem` decides which front door
is served, the same way `STORAGE_DRIVER` decides where files go. An organisation that
sees "Start your free trial" on a system their procurement already bought has
been sold something twice, and it reads as carelessness.

### The insight that shapes the build

At N$ 1,200 a month with margins to stay above 90 %, **support volume is the
binding constraint, not infrastructure.** That is already recorded as the
reason onboarding and CSV import are commercial features rather than niceties.

It applies here too, and changes what this is. The "how to use the features"
pages are not marketing. They are **call deflection**. Every page that answers a
question before somebody picks up the phone is margin defended. Which means:

- The help content must be reachable **from inside the app, at the point of
  confusion** — a link on the stocktake screen to the page about counting —
  not only from a website nobody visits twice.
- It must be written once and served in three places: the public marketing
  site, the on-premise pre-login pages, and in-app help.
- It must be good. A help page that does not answer the question is worse than
  none, because it costs the call *and* the trust.

So: **one content source, three surfaces.** Content as MDX or plain modules in
the Next app — no CMS. A CMS is another service to host, another thing to go
down, another subscription against a 90 % margin, and it cannot work on-premise
at all.

### The constraint that decides the technology

An on-premise site is on an organisation's network with no inbound access and often no
internet. **Every public page must render with no outward request.** That rules
out a hosted CMS, an analytics tag, an embedded chat widget, a font from a CDN
and an image from a bucket.

One correction to an earlier draft of this plan, because it changes the work:
**fonts are already safe.** `next/font/google` downloads at build time and
self-hosts into the bundle — the built CSS points at `/_next/static/media/*.woff2`
and nothing in the shipped output names Google at all. The build needs the
network; the served page does not, and the image is built in CI either way.
There is no font work to do.

What the constraint does still rule out is everything that reaches out *at
runtime*: a hosted search index, an analytics tag, an embedded chat widget, a
CDN script, an image served from a bucket. Search is therefore computed in the
browser from content that ships with the page, and images live in the repo.
The on-premise build is still verified with the network switched off, because
the cheapest way to be sure is to look.

### The pages

**Both editions** — the shared content, which is most of it:

- **How MOTION works** — the document that goes quote → booking → job card →
  invoice, because that single spine is the product and nothing else explains it.
- **Guides, by job to be done** — taking a booking, clocking on a job, ordering
  parts, counting stock, chasing what is owed, closing a month, handing the
  books to the bookkeeper. Written as tasks, not as a tour of menus.
- **Getting started** — the first hour: import your customers, set your tax,
  put your logo on an invoice, raise the first job card.
- **Contact and support** — hours, channels, what counts as urgent, and what to
  have ready when reporting a problem.
- **Release notes** — what changed and when. Public bodies ask for this by name, and
  it is the cheapest credibility a small vendor can buy.

**Cloud only:**

- **Home** — one sentence on what it does, the price, and a way to start.
- **Pricing** — see the open question below.
- **Why not a spreadsheet** — the real competitor in this market is paper and
  Excel, not other software. Address it directly.
- **Start a trial / request a demo.**

**On-premise only:**

- **About this installation** — which workshop, which version, who installed it
  and when, where the data lives, when it was last backed up.
- **Who to ring** — the site's own administrator first, then us. An organisation's
  staff should never be told to email a vendor about a forgotten password.

### What this is not

Not a redesign of the application. The signed-in product is finished through
R1–R7 and this is a shell in front of it.

## Part two — the documents

The brainstormed checklist is a sound taxonomy of enterprise software
documents. It is also roughly ninety of them, and it was written for vendors
with a sales team, a compliance officer and six-figure contracts.

The useful reframe: **a document is a cost until a buyer asks for it.** Write
the ones that unblock a sale or prevent a support call. Everything else is
inventory that goes stale and then misleads somebody.

Three tiers, sequenced by what they unblock.

### Tier one — cannot take money without these

Eight documents. This is the whole list for a private workshop sale.

| Document | Why it is not optional |
| --- | --- |
| Pricing sheet | Tiers, what each includes, what is billable |
| Terms of service / EULA | One per edition — hosted and installed differ |
| Privacy policy | Legally required the moment a real customer's data lands |
| Support policy | Hours, channels, response targets, what "urgent" means |
| Onboarding / getting-started guide | The commercial feature margin depends on |
| Help content | The same, and it is Part One's content |
| Invoice and quote templates | The paperwork of actually being a business |
| Care plan description | Hand-holding is **sold**, not bundled — already decided |

### Tier two — before an organisation will sign — **written**

Procurement will ask for these by name and a missing one stalls a tender for a
month. The good news is how much of it already exists as working code rather
than as prose to invent.

Written as four documents rather than nine, because several of them are one
document in practice: an organisation asks for a DPA and expects retention inside it,
and nobody runs a UAT plan separately from the cutover checklist it leads to.

| Document | Covers |
| --- | --- |
| [security-whitepaper.md](security-whitepaper.md) | Isolation, credential storage, permissions, the audit trail, the outbound-only posture — and a named list of what MOTION does not have |
| [data-protection.md](data-protection.md) | Controller and processor, what is held, who can reach it, retention, deletion, and getting everything out |
| [continuity-and-recovery.md](continuity-and-recovery.md) | What recovery depends on, what the pipeline proves on every change, and what cannot be promised until a host is chosen |
| [integration-guide.md](integration-guide.md) | The nightly journal, the four column maps, the receipt leg, the archive, and the API |
| [implementation-pack.md](implementation-pack.md) | RACI, a 24-row UAT script, the cutover, rollback rules, the escalation matrix and an acceptance signature |

Each was written from the shipped code and its figures verified rather than
recalled. What they share is the section naming what is absent: no MFA, no SSO,
no automated backups, no encryption at rest MOTION can attest to, no SOC 2, no
penetration test, no uptime commitment, no subprocessor list, no registered
entity. Procurement finds those anyway — later, and with less goodwill.

**This is the real finding.** The security questionnaire that usually takes a
small vendor a month is mostly a description of decisions already made and
tested. The gap report proves document completeness. The export log answers
"who has been taking data out". The outbound-only hand-off is exactly the
network posture public bodies demand and most vendors cannot offer. That is not
paperwork to produce — it is evidence to write down.

### Tier three — not yet, and what would trigger it

Named so they are deliberately deferred rather than forgotten.

| Deferred | What would trigger it |
| --- | --- |
| SOC 2 / ISO 27001 | A buyer who contractually requires it. Six figures and a year; there is no sane way to do it before revenue |
| Software escrow | An organisation naming it in a tender — plausible, and the bundle is a cheaper answer to the same fear |
| Certification programme, train-the-trainer | Enough sites that training does not scale one at a time |
| Partner / reseller kit | A first partner who asks |
| CPQ rules, discount approval matrix, margin model | More than one person quoting |
| QBR decks | An account large enough to review quarterly |
| VPAT / accessibility | A government tender requiring it. Worth doing the work regardless; the *document* waits |
| Penetration test summary | A buyer asking, or the first go-live at an organisation with its own fleet — whichever is first |

### What the checklist got right that is easy to miss

- **Training is billable and scoped separately from the licence.** That matches
  the care-plan decision already taken, and it is the correct instinct: at this
  price point, bundled hand-holding destroys the margin.
- **The entitlement matrix.** Exactly what each tier includes, in a table. It
  prevents the support conversation that begins "but I thought that was
  included", which is the most expensive conversation there is.
- **Deprecation and release notes.** Cheap, and they make a one-person vendor
  look like an organisation.

## Part three — getting into the market

Two buyers, and the order matters.

**Private workshops first.** Small, fast, decided by one person who owns the
place. They pay N$350–600 and will go back to Excel past N$1,000. Three to five
of them, onboarded by hand, will:

- prove the product survives contact with a real workshop;
- generate the help content, because every question asked becomes a page;
- produce the reference sites an organisation will ask for.

**Organisations with their own fleets second, and only with references.** They run SOLAR, Sage, SAP or
Odoo, authenticate against Active Directory, and buy through procurement. They
are slow, they ask for tier-two documents, and they will not be the first
customer of an unproven vendor. But they pay more, they stay, and the hand-off
built this month is aimed squarely at them.

**The wedge against the benchmark has moved, and the copy must move with it.**
Since 1 December 2025 Workshop Software publishes rand prices: Silver R1,400,
Gold R1,700 and Platinum R2,900 a month, or R1,100, R1,400 and R2,400 a month
billed yearly (rand and Namibian dollar are at par). The old figure of
N$3,127–5,532 is out of date. MOTION's N$1,200 and N$2,400 now sit *at* the
benchmark's price, and its yearly Silver plan is cheaper than MOTION's entry
tier — so **compete on scope, never on price.** What it does not have:
purchase requisitions with quotations and sign-offs, the fleet route, a floor
app that works without a signal, an edition installed on the buyer's own
servers (its hosting is in Australia, the US and Europe; MOTION's hosted
edition is in the US too, so residency is the installed edition's answer),
and payments that work in Africa. Technician clocking needs its Gold
plan. MOTION handles the licence disc, the roadworthy, VAT at 15 % and
WhatsApp, in every plan.

For organisations with their own fleets, say **workshop system**, never
"fleet management system": in South African tenders that phrase means vehicle
tracking. MOTION works *beside* the tracking provider and the finance system
(SAP PM, SOLAR, Pragma On Key at the large end), not instead of them. Where a
fleet is bought as a bundle — South Africa's national contract RT46-2026 puts
maintenance with Afrirent until June 2031 — the opening is the garage doing
the work, which must keep a record of quotes and approvals. In Namibia,
central government built its own fleet system in November 2025; councils and
state-owned companies with their own garages remain the buyers. Sources and
dates: [reports/MOTION compliance and market facts.md](../reports/MOTION%20compliance%20and%20market%20facts.md).

## Decided

1. **The hosted edition is for sale.** Production runs on one server (see
   [architecture.md](architecture.md), ADR-007) at motionworkshopmanager.com,
   with self-service registration.
2. **Prices are published** for the two workshop plans (N$ 1,200 and
   N$ 2,400 a month, excluding VAT). Fleet and multi-site is quoted per site.
3. **The legal entity is Omzizi Investment CC**, trading as Motion Dynamic
   Systems, registered and VAT-registered. The terms and privacy policy are
   still drafts; see [legal-review-2026-11.md](legal-review-2026-11.md) for
   what counsel must settle.

## What I would build first

In order, smallest useful thing first:

1. **The help content engine** — one content source, rendered publicly and
   in-app. It is the margin defence, it is most of both websites, and it is
   useful the day it exists even with no marketing site around it.
2. **The on-premise front door** — about this installation, who to ring, the
   guides. Smaller than the marketing site and unblocks the buyer who pays more.
3. **Tier-one documents** — the eight, because none of them can be skipped to
   take a first payment.
4. **The cloud marketing site** — after a host is chosen, so the call to action
   is real.
5. **The security whitepaper** — mostly transcription of what already exists,
   and the thing that will most often decide a public body's tender.
