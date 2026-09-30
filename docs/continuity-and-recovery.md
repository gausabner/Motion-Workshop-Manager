# Business continuity and recovery

What happens when something breaks, how MOTION comes back, and — stated plainly
— what is not yet in place. For the IT manager who has to satisfy themselves
that a workshop can keep trading.

Last reviewed 30 September 2026 against the shipped pipeline.

---

## The honest position first

**MOTION has no automated off-site backup of its own.** Not on an installed
site, where backups are the site's own responsibility today, and not on the
hosted service, because no hosting platform has been chosen yet.

Everything below is true and demonstrable. This paragraph is here because a
continuity document that opens with its strengths and buries that is not a
continuity document.

## 1. What recovery actually depends on

Two things, and they are separable:

| | Where it lives | How it comes back |
| --- | --- | --- |
| **The application** | A container image, built and published by pipeline | Pull the image and start it. Minutes |
| **Your data** | PostgreSQL, plus stored files | From a backup. **This is the part that needs a decision** |

The application is genuinely disposable — it holds no state, and a lost server
is replaced by starting the same published image somewhere else. The data is
the whole problem, which is why it gets the honest paragraph above.

## 2. What the pipeline proves on every change

This is not a described procedure; it runs on every commit and fails the build
if it stops being true.

- The image builds from source, reproducibly, never from a developer's laptop.
- It is started against a **completely empty database** — the state a first
  deployment or a recovery from bare metal finds.
- The migrations apply and create the schema. The build fails if fewer tables
  appear than expected, so a half-applied migration cannot pass.
- The application serves its login page.
- The database is then **stopped**, and the health endpoint must report failure.
  A health check that cannot fail is decoration, and one that reports healthy
  while the database is gone will keep a load balancer sending traffic into a
  dead instance.

The practical consequence: *restoring MOTION onto a bare server is a rehearsed
path rather than a hoped-for one.* It is rehearsed several times a week, by
machine, as a side effect of ordinary work.

## 3. Recovery, step by step

**A lost application server.** Start the published image against the existing
database, with the same environment. Nothing else is required; the application
carries no state of its own.

**A lost database.** Restore from backup, then start the image against it. The
migrations are idempotent and will bring a restored database to the current
schema. *Recovery time is dominated entirely by the restore, which is why the
backup decision below is the one that matters.*

**A corrupted upgrade.** Images are tagged by commit, so the previous one is
still in the registry. Roll back by starting the previous tag. Note the
constraint: a migration that has already run is not undone by starting an older
image, so a rollback across a schema change needs the database restored to
match.

**A workshop that has lost its own data through mistaken use.** Different
problem, better answer: nothing in MOTION is deleted outright. Voided documents
keep their numbers, deleted documents keep their entire contents in the audit
trail, and the stock ledger is a record of movements rather than a number that
was overwritten.

## 4. What each client should have in place

Because MOTION does not do this for you yet, and saying so is more useful than
implying otherwise.

**Installed sites.** A nightly `pg_dump` of the MOTION database, kept off the
machine that runs it; a copy of the attachments directory or S3 bucket; and the
environment file, which holds the settings but should be handled as a secret. A
restore tested once, not assumed — an untested backup is a belief.

**Hosted service.** Whatever the chosen platform provides, plus MOTION's own
full export as an independent copy. The export is deliberately readable without
MOTION, so it survives even the scenario where we do not.

> **To decide.** Whether a managed platform's automated backups are sufficient
> for the hosted service or whether MOTION runs its own on top. This is the
> single open item that most affects what can be promised in a contract.

## 5. What cannot be promised yet

| | Position |
| --- | --- |
| **Recovery time objective** | Not committed. The application side is minutes; the database side depends on a backup arrangement that does not exist yet |
| **Recovery point objective** | Not committed, for the same reason. An RPO is a statement about backup frequency |
| **Uptime percentage** | None published. A figure that cannot be measured is worse than no figure, and there is no monitoring in place to measure one |
| **A tested failover** | Not performed. There is no second environment to fail over to |

These are answerable, and none is expensive — they are blocked on choosing a
host, not on engineering.

## 6. Keeping trading while MOTION is down

Worth stating because it is the question an owner actually asks.

A workshop is not stopped by MOTION being unavailable. Jobs are written on
paper for the hour, as they were before, and entered afterwards — the document
spine is designed so a job card raised late is no different from one raised on
time. What is lost is convenience, not the day's work.

The offline floor app continues to accept clock-on and clock-off while the
network is gone, and queues those events to replay when it returns. Replay is
idempotent: an event that arrives twice is recorded once.
