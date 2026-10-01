# Business continuity and recovery

What happens when something breaks, how MOTION comes back, and — stated plainly
— what is not yet in place. For the IT manager who has to satisfy themselves
that a workshop can keep trading.

Last reviewed 1 October 2026 against the shipped pipeline.

---

## The honest position first

MOTION now takes its own off-site backups: a nightly `pg_dump`, encrypted
before it leaves the machine, uploaded to an S3-compatible bucket, pruned on a
fixed schedule, and restored into a scratch database every week to prove it
still works. `ops/backup/` holds it and `ops/backup/README.md` describes it.

Two things are still true and are stated here rather than buried:

- **It is per-installation configuration, not a default.** A site that has not
  been given a bucket and a key pair has no off-site backup. Commissioning is
  not complete until `motion-verify.sh` has been run once and passed.
- **The recovery point is up to twenty-four hours.** A nightly dump is a
  nightly dump. Getting below that needs continuous WAL archiving, which is a
  larger piece of work and is not built. For a workshop, a day re-entered from
  paper is survivable — but it has to be said in the contract rather than
  implied away.

## 1. What recovery actually depends on

Two things, and they are separable:

| | Where it lives | How it comes back |
| --- | --- | --- |
| **The application** | A container image, built and published by pipeline | Pull the image and start it. Minutes |
| **Your data** | PostgreSQL, plus stored files | From the night's off-site backup. Section 4 |

The application is genuinely disposable — it holds no state, and a lost server
is replaced by starting the same published image somewhere else. The data is
the whole problem, which is why most of this document is about it.

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

## 4. What the backup actually does

Nightly, at 02:10 in the workshop's own time:

1. **Dumps the database** with `pg_dump --format=custom`. Ownership and grants
   are kept, not stripped — row-level security is enforced through them, and a
   dump that discarded them would restore a database whose tenant boundaries no
   longer bite.
2. **Dumps the cluster roles** as well. Roles are not part of a database dump,
   and without them a restore onto bare metal produces policies referring to
   roles that do not exist. Role *passwords* are deliberately excluded — those
   hashes are not something to ship off-site — and are set from the
   deployment's own environment on restore.
3. **Archives the attachments**, where they are on local disk. With the S3
   storage driver they are already in a bucket and are not copied into a
   second one.
4. **Encrypts everything** before upload. A fresh random passphrase per backup
   encrypts the dump; that passphrase is wrapped with an RSA public key. The
   server holds only the public half, so it can write backups it cannot itself
   read: a compromised server cannot decrypt its own history, and a leaked
   bucket is noise. The private key is held by the owner, off the server.
5. **Writes a plaintext manifest** — sizes, hashes, server version, table
   count — so bucket contents can be audited without the private key. It names
   no customer, vehicle or amount.
6. **Moves the `LATEST` pointer last**, once every other object is uploaded. A
   run that dies halfway leaves the previous backup as the newest complete one,
   rather than leaving a torn backup to be discovered during a restore.
7. **Prunes** to fourteen dailies, roughly eleven month-end copies and a
   yearly. Two years of history is twenty-five objects.
8. **Sends a heartbeat**, if one is configured. The ordinary way backups fail
   is that the job stops running and nobody notices for months; nobody notices
   the absence of an email.

### What proves it

Four test suites run in CI on every change, and a weekly restore runs against
the live backup.

| | What it establishes |
| --- | --- |
| `s3.test.sh` | The request signing matches the worked example AWS publishes — the same vectors the application's own S3 client is checked against |
| `rotate.test.sh` | The retention policy keeps what it claims. Pruning is the one part whose bugs are silent: it deletes what you were going to need and says nothing until you need it |
| `crypt.test.sh` | The encryption round-trips, and refuses the wrong key, a single flipped byte, and a damaged envelope — rather than restoring something subtly wrong |
| `e2e.test.sh` | The whole path against a real PostgreSQL: dump, seal, upload, list, prune, fetch, unseal, restore, and confirm the rows **and the row-level security** came back |
| `motion-verify.sh` | Weekly, against the actual latest backup: restores it into a scratch database, checks the data is there and the policies survived, and reports how long it took |

That last one is the one that matters. Everything above it can work perfectly
and still leave you with nothing; a backup is a belief until it has been
restored.

## 4a. What each client should still have in place

**Installed sites.** A bucket and a key pair, configured at commissioning —
and the private key kept somewhere other than the server, in two places,
because one copy is not a copy. Losing it makes every backup unreadable; that
is a property of the design rather than a flaw in it, and the alternative is a
server that can decrypt its own off-site history.

**Hosted service.** The above, plus MOTION's own full export as an independent
copy. The export is deliberately readable without MOTION, so it survives even
the scenario where we do not.

## 5. What can and cannot be promised

| | Position |
| --- | --- |
| **Recovery point objective** | **24 hours.** One backup a night. A workshop that loses its server loses at most that day's entries, which are re-entered from the paper the floor already works from |
| **Recovery time objective** | **Under an hour**, for a site with a configured bucket. The application is a container image and starts in minutes; the restore itself is dominated by downloading the dump, not by PostgreSQL. A 300 KiB dump restores and verifies in two seconds on local hardware; at realistic sizes over a Namibian link the download is the whole of it. The weekly verification reports the real figure for each site, which is the number to quote rather than this one |
| **Backups are tested** | **Yes, weekly**, by restoring them. This is the claim most backup policies cannot make |
| **Backups are encrypted off-site** | **Yes**, and the server that writes them cannot read them |
| **Point-in-time recovery** | **No.** Nightly granularity only. Sub-day recovery needs WAL archiving, which is not built |
| **Uptime percentage** | **None published.** There is no monitoring in place to measure one, and a figure that cannot be measured is worse than no figure. Blocked on choosing a host, not on engineering |
| **A tested failover** | **Not performed.** There is no second environment to fail over to. Recovery is restore-and-start, not switch-over |

> **To decide.** The host. Not for the backup's sake — the backup arrangement
> is deliberately independent of it, and works the same on any Linux server
> with a bucket — but the uptime figure and the data-residency answer both
> wait on it.

## 6. Keeping trading while MOTION is down

Worth stating because it is the question an owner actually asks.

A workshop is not stopped by MOTION being unavailable. Jobs are written on
paper for the hour, as they were before, and entered afterwards — the document
spine is designed so a job card raised late is no different from one raised on
time. What is lost is convenience, not the day's work.

The offline floor app continues to accept clock-on and clock-off while the
network is gone, and queues those events to replay when it returns. Replay is
idempotent: an event that arrives twice is recorded once.
