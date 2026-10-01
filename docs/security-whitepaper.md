# MOTION Workshop Manager — security

For the person in procurement who has to satisfy themselves before signing, and
for the IT manager who will be asked whether this is safe to put on their
network.

Every claim below describes something that exists in the product today and can
be demonstrated on request. Where something is **not** yet true — and several
things are not — it says so under [What MOTION does not have yet](#what-motion-does-not-have-yet)
rather than being left for you to discover. A security document that only
lists strengths is telling you what it wants you to hear.

Last reviewed 30 September 2026 against the shipped code.

---

## The short version

- Each workshop's data is separated **by the database itself**, not by the
  application remembering to filter. 50 of 59 tables carry a row-level policy
  that binds even the account the application connects as.
- Nothing that could be replayed is stored in a form that can be used: passwords,
  session tokens, API keys, invitations, password-reset links and customer share
  links are all kept as one-way values.
- Who did what is recorded — including who took data **out**, which is a
  question most workshop software cannot answer at all.
- An installed site sends **outbound only**. Nothing listens for an inbound
  connection, and no integration requires your network to open a door.
- Your data is exportable in full, by you, at any time, without asking us.
- Backups leave the building **encrypted with a key the server does not hold**,
  and are restored every week to prove they work.

---

## 1. Keeping one workshop's data away from another's

This is the risk that matters most in a multi-tenant system, so it is defended
twice, in two different technologies, on the assumption that either one alone
will eventually be got around.

**In the application.** Every database query goes through a client bound to one
workshop. That client is deny-by-default: a write that does not name a workshop
raises an error rather than running unscoped, and this covers every write
operation the database library offers, including ones added after the guard was
written. The rule was not written from theory — an unscoped update had reached
another client's row during development, which is what the guard exists to stop
happening again.

**In the database.** PostgreSQL row-level security policies compare every row
against the workshop announced on the connection. Of 59 tables, 56 carry a
policy and **50 are `FORCE`d**, which means the policy binds even the role that
owns the tables. A query that has not said which workshop it is for returns
nothing and writes nothing — it does not quietly return everything.

**The six that are not forced, and why.** `Session`, `Membership`, `ApiKey`,
`Invitation`, `ShareLink` and `PasswordReset`. Each answers the question *which
workshop is this?* and therefore cannot itself be scoped by the answer: a
sign-in looks up a session before it knows the workshop, an API request looks up
a key, somebody following a reset link is by definition not signed in. All six
keep row-level security enabled, so any role that does not own the tables is
still bound, and every one of them is reachable only by presenting a value that
cannot be guessed — a hashed token, or a user id that is already authenticated.

**It is tested, not asserted.** The separation is covered by automated tests
that run against a real PostgreSQL as a restricted role: cross-workshop read,
update, delete and relation traversal all return nothing; a write naming another
workshop is re-scoped to the caller's own; a non-member gets "not found" rather
than "not allowed", so the system does not confirm that a record exists.

## 2. Credentials and anything else that could be replayed

Nothing in this list is recoverable from what is stored.

| What | How it is held |
| --- | --- |
| Staff passwords | bcrypt, cost factor 12 |
| Session tokens | SHA-256 with a server-side secret; only the hash is stored |
| API keys | SHA-256 with a server-side secret; shown once at creation and never again |
| Invitations | Hashed; single use; expire after 7 days |
| Password reset links | Hashed; single use; time-limited |
| Customer share links | Hashed; expire; revocable at any time |

API keys additionally carry a visible prefix so a workshop can identify a key in
a list without the key itself being retrievable, and comparisons are
constant-time so a key cannot be recovered a character at a time by measuring
how long a rejection takes.

**The public API** is rate limited per key — 120 requests a minute, counted on
the key's own row so every application instance shares one window rather than
each permitting the limit separately. A revoked key keeps its row, so revocation
is a fact in the audit trail rather than an absence.

**Session cookies** are `httpOnly` (unreadable by scripts in the page),
`sameSite=lax`, and marked `Secure` whenever the connection is HTTPS. The
`Secure` flag follows the actual connection rather than the build, which is
deliberate: tying it to the build marked cookies `Secure` over plain HTTP on an
internal network, and Safari — correctly — then refused them, so nobody could
sign in at all.

## 3. Who can see what

Access is by role, and roles are **deny-by-default**: a permission not granted
is refused, rather than everything being allowed until something denies it.
Individual extra permissions can be granted on top of a role without inventing
a new one.

Two behaviours worth stating explicitly, because they are the ones usually got
wrong:

- **Contact details are removed on the server**, before the page is built, for
  anybody whose role does not include seeing them. They are not hidden with CSS
  or a conditional in the markup, which leaves them sitting in the page source
  for anyone who opens the developer tools. Names are deliberately kept — a
  mechanic needs to know whose car is on the lift.
- **The same redaction applies to exports.** A download is never the way around
  a permission somebody was not given.

Where a user may not see a record at all, the system answers "not found" rather
than "not allowed", so it does not confirm the existence of what it is hiding.

## 4. What is recorded

MOTION keeps an audit trail of who did what, with a timestamp and the actor.
Three properties matter to an auditor:

- **Deletions keep their content.** Before a document row is removed, the whole
  document — every line, the totals, the customer, the vehicle, who deleted it
  and the reason they gave — is written into the audit trail. "Who deleted it" is
  half an answer; the other half is what was on it.
- **Numbers are never reused.** A voided document keeps its number and stays on
  the books at nil value. MOTION produces a report listing every number issued in
  a period and accounting for each one that is missing, so completeness can be
  demonstrated rather than asserted.
- **Taking data out is itself recorded.** Every export writes who exported what,
  over which period, in which format, and how many rows — never the rows
  themselves, because an audit trail that copies the data it audits doubles the
  problem. "Who has been taking the customer list out" is answerable.

## 5. Installed on your own network

The operating model is **outbound only**. MOTION on your hardware may reach out —
a licence heartbeat, and whatever exports you configure — and nothing ever
reaches in. There is no inbound port, no VPN requirement, and no agent listening
for instructions.

Every integration follows from that. The accounting hand-off writes a file into
a folder that your accounting system collects; it does not connect to your ERP
and your ERP does not connect to it. Where confirmation is wanted, the receiving
system writes a small file back that MOTION reads on its next run. That contract
is deliberately the smallest thing an ERP-side script can honour, because a site
that will not permit a listening service will permit a scheduled task that
writes a file.

For the hosted service the same data-handling applies, on servers we operate.

## 6. Getting your data out

At any time, without asking and without notice, an owner can download every
table as CSV in a single archive, with a README explaining how the tables join.
Flat files rather than a database dump, because a dump is only useful to
somebody running the same version of the same product — which is exactly the
dependency the export exists to dissolve.

This is the answer to "what do we have if you stop existing", and it is a
working feature rather than a clause in a contract. The download is recorded in
the audit trail like any other.

## 7. Availability and change

- The deployable image is built and published by automated pipeline, never from
  a developer's laptop.
- Every build starts the application against an empty database and verifies that
  the migrations apply, the login page renders, and the health check reports
  failure when the database is stopped. A health endpoint that cannot fail is
  decoration.
- The health endpoint reports whether the database is reachable and nothing
  else — no version, no host, no schema, no record counts.
- Automated tests run on every change: unit tests for the rules, database tests
  against a real PostgreSQL including the isolation tests above, and browser
  tests across Chromium, Android and iOS engines.

## 8. Backups, and how they are protected

A nightly dump of the database and its roles, plus the attachments where they
sit on local disk, uploaded to an S3-compatible bucket and pruned to fourteen
daily copies, roughly eleven month-end copies and a yearly one.

Three properties are worth a procurement officer's attention:

**The server cannot read its own backups.** Each backup is encrypted with a
fresh random key, and that key is wrapped with an RSA public key. Only the
public half is on the server. Someone who takes the server, or the bucket, or
both, has ciphertext. The private half is held by the workshop or the council,
not by MOTION, and not on the machine — which also means MOTION cannot read
your backups either.

**The backups are restored, not merely taken.** A scheduled job restores the
latest backup into a scratch database every week, checks the data is present,
checks the row-level security policies survived, and reports how long it took.
That figure is the recovery time, measured rather than estimated. An untested
backup is a belief, and most backup policies are exactly that.

**A damaged backup is refused rather than half-restored.** The hash of the
dump is recorded inside the encrypted envelope at the time it is taken. A
single altered byte anywhere in the stored object makes the restore stop and
say so, instead of producing a database that looks plausible.

What this does **not** give you is point-in-time recovery. The granularity is
one night, so a failure can cost up to a day of entry — re-entered from the
paper the floor already works from. Going finer needs continuous WAL
archiving, which is not built.

The scripts, and a plain account of their limits, are in `ops/backup/`.

## What MOTION does not have yet

Named here rather than omitted, because procurement will ask and finding out
later is worse than being told now.

| Not yet | Position |
| --- | --- |
| **Multi-factor authentication** | Not implemented. Realistic to add, and the right first ask for a council. |
| **Single sign-on / Active Directory** | Not implemented. Understood to be a procurement requirement for councils and planned as one; no work has started. |
| **Point-in-time recovery** | Not implemented. Backups are nightly, so the recovery point is up to 24 hours. Continuous WAL archiving would close this and is not built. See section 8. |
| **Backups configured by default** | The scripts ship with the product; the bucket and key pair are set up per installation. A site that has not been commissioned has no off-site backup, which is why commissioning is not complete until a restore has been run and passed. |
| **Encryption at rest for the live database** | Depends on the host, which is not chosen. PostgreSQL and the storage layer both support it; it is not something MOTION currently configures or can attest to. Note that this is separate from the backups, which *are* encrypted before they leave the machine — see section 8. |
| **SOC 2 / ISO 27001** | Neither held. Both are a year and six figures; there is no honest way to have them before revenue. |
| **Independent penetration test** | Not yet commissioned. Worth doing before a first council go-live. |
| **A published uptime commitment** | None. A figure that cannot be measured is worse than no figure. |
| **Named subprocessor list** | Not published, because hosting is not chosen. Owed before any council contract. |
| **A registered legal entity** | Not yet registered. The terms and privacy policy are drafts and say so. |

## Asking us about this

Anything here can be demonstrated rather than taken on trust: the isolation
tests can be run in front of you, the audit trail can be queried, and the full
data export can be produced on the spot.

Contact details are on the support page.
