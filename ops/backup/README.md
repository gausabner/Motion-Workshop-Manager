# Off-site backups

A nightly `pg_dump`, encrypted before it leaves the machine, uploaded to an
S3-compatible bucket, pruned on a grandfather-father-son schedule, and — the
part that makes the rest mean anything — restored into a scratch database
every week to prove it still works.

Nothing here depends on the MOTION application. It needs `bash`, `curl`,
`openssl` and the PostgreSQL client tools, which a Linux server has before
anyone installs anything. That is deliberate: a backup has to run on the night
the application will not start.

## What a backup consists of

| Object | Why |
| --- | --- |
| `<prefix>/db/<stamp>.dump.enc` | The database, `pg_dump --format=custom`, sealed |
| `<prefix>/db/<stamp>.dump.envelope` | Its passphrase and plaintext hash, RSA-wrapped |
| `<prefix>/roles/<stamp>.sql.enc` | Cluster roles. Without them a bare-metal restore has policies referring to roles that do not exist |
| `<prefix>/files/<stamp>.tar.gz.enc` | Attachments, for `STORAGE_DRIVER=local` only |
| `<prefix>/manifest/<stamp>.txt` | Plaintext. Sizes, hashes, server version, table count. Names no customer, vehicle or amount |
| `<prefix>/LATEST` | The newest *complete* backup's stamp |

`LATEST` is written last, after every other object for that stamp is in the
bucket. A run that dies halfway leaves the previous backup as the newest one
rather than leaving a torn backup to be discovered during a restore.

## Setting it up

### 1. The key pair

**Generate this somewhere other than the server**, and keep the private half
away from it. The server gets only the public half, so it can write backups it
cannot itself read — which is the whole point.

```bash
openssl genrsa -out backup-private.pem 3072
openssl rsa -in backup-private.pem -pubout -out backup-public.pem
```

The private key is now the single thing standing between you and every backup
being unreadable. It belongs wherever the company's irreplaceable documents
belong — and in a second place, because one copy is not a copy. Losing it
cannot be recovered from; that is a property of the design, not a flaw in it,
and the alternative is a server that can decrypt its own off-site backups.

### 2. The bucket

Any S3-compatible store. Cloudflare R2 charges nothing for egress, which is
what you are paying for on the day you restore. Create a bucket, then an
access key scoped to it alone — not an account-wide key.

### 3. The config

```bash
sudo mkdir -p /etc/motion
sudo install -m 600 -o root -g root backup.env.example /etc/motion/backup.env
sudo install -m 644 backup-public.pem /etc/motion/backup-public.pem
sudo $EDITOR /etc/motion/backup.env
```

### 4. Run it once by hand

```bash
ops/backup/motion-backup.sh
```

### 5. The timer

```bash
sudo cp ops/backup/motion-backup.{service,timer} /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now motion-backup.timer
systemctl list-timers motion-backup.timer
```

### 6. Prove it restores — before you need to

```bash
BACKUP_PRIVATE_KEY=./backup-private.pem \
VERIFY_ADMIN_URL="postgresql://postgres:...@host:5432/postgres" \
  ops/backup/motion-verify.sh
```

This creates a scratch database, restores the latest backup into it, checks
the tables are populated and that row-level security survived, drops the
scratch database, and prints how long the restore took. **That number is the
recovery time**, measured rather than estimated, and it is what
`docs/continuity-and-recovery.md` quotes.

Run it from the machine that holds the private key, weekly, with
`motion-verify.timer`. A backup system without this step is a filing cabinet
nobody has opened.

## Restoring

```bash
# Where the data went, and what was in it
ops/backup/motion-restore.sh latest --into "postgresql://...:5432/motion_restored"

# A specific night, with attachments and cluster roles
ops/backup/motion-restore.sh 20261001T020000Z \
  --into "postgresql://...:5432/motion_restored" \
  --files /var/lib/motion/attachments \
  --roles
```

`--into` is required and has no default: this command replaces every table in
its target, and the obvious default would be production. Restoring over the
database named in the config is refused outright unless `--force` is added too.

Onto a bare server, in order:

1. Create the database.
2. Restore with `--roles`, which recreates the cluster roles the policies
   reference. Role **passwords are deliberately not in the backup** — the
   hashes are not something to ship off-site — so set them afterwards from the
   deployment's own environment: `ALTER ROLE motion_app PASSWORD '…'`.
3. Start the application image, which applies any migrations newer than the
   dump.

## Operating it

**Where it logs.** `journalctl -u motion-backup.service -n 50`. Each run prints
what it dumped, what it uploaded and what it pruned.

**The heartbeat.** The usual way backups fail is that the job stops running and
nobody notices for months — nobody notices the absence of an email. Set
`BACKUP_HEARTBEAT_URL` to a dead-man's-switch that complains when the nightly
ping stops arriving. This is the cheapest protection in the whole directory.

**Retention.** Fourteen dailies, about eleven month-end copies, and a yearly.
`rotate.sh` explains the tiers, including why there is no weekly one. Note that
the daily window counts against the monthly allowance, so twelve months
configured yields roughly eleven months of month-end copies.

**Cost.** A workshop's database compresses to single-digit megabytes. Two years
of history under this policy is twenty-five objects. On R2 that is cents a
month; the attachments, if they are on local disk, will dwarf it.

**Speed.** Pruning sends one DELETE per object, and signing each costs a
handful of `openssl` calls. A nightly prune touches a few objects and is
instant. Pruning a bucket with years of unpruned history in it takes minutes —
it is a one-off, and it is not worth the complexity of batched deletes to
avoid.

## Testing it

```bash
make test-backup
```

- `s3.test.sh` — the signer, against the worked example AWS publishes. The same
  vectors `web/src/lib/storage/sigv4.test.ts` checks the TypeScript client
  against; two independent implementations agreeing with AWS is the reason to
  trust either.
- `rotate.test.sh` — the retention policy against generated histories. Pruning
  is the one part whose bugs are silent: it deletes the thing you were going to
  need and says nothing until you need it.
- `crypt.test.sh` — the envelope, round-tripped, and every way it must refuse:
  the wrong key, a flipped byte, a junk envelope.
- `e2e.test.sh` — the whole path against the real local database and a bucket
  that checks its own signatures. Dump, seal, upload, list across pages, prune,
  fetch, unseal, restore, and confirm the rows and the row-level security came
  back. Skips if the local database is not running.

`s3.stub.py` is the bucket the end-to-end test runs against. It is not a mock
that says yes: it recomputes every signature independently, in Python, and
returns 403 when it disagrees with the shell client.

## What this does not do

Stated plainly, because a backup document that lists only its strengths is not
useful.

- **Point-in-time recovery.** A nightly dump means the recovery point is up to
  twenty-four hours. Getting below that needs WAL archiving, which is a
  different and larger piece of work. For a workshop, a day of re-entry from
  paper is survivable; say so in the contract rather than implying better.
- **A second running environment.** There is no failover. Recovery is restore
  and start, not switch over.
- **Monitoring of the application itself.** The heartbeat proves the backup
  ran, not that MOTION is up.
