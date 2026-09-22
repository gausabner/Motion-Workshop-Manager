# Deploying MOTION to Render

Staging first. The same blueprint makes production later, on a bigger plan with
backups that have been restored from at least once.

## What you do, and what I cannot

Creating the account, connecting the repository and holding the card are yours —
I cannot create accounts or enter credentials. Everything else is in
`render.yaml`, so there is nothing to configure by hand and nothing to remember.

1. Sign in to Render and connect this GitHub repository.
2. **New → Blueprint**, choose the repository, and apply.
3. Render creates `motion-staging` (web) and `motion-staging-db` (Postgres),
   wires `DATABASE_URL` between them, and generates `SESSION_SECRET`.

First boot takes a few minutes: Render builds the image, the entrypoint runs
`prisma migrate deploy` against an empty database, then the server starts.

## What to check once it is up

- `https://<service>.onrender.com/api/health` returns `{"ok":true}`. It asks
  Postgres before answering, so this is a real check rather than a heartbeat.
- The login page renders.
- **Register a workshop through the UI.** The database starts empty — there is
  no seed on Render, deliberately. Seed data is dev convenience; a staging
  environment that ships with a fictional workshop's books invites someone to
  mistake them for real ones.

## Region

Frankfurt. Namibia's undersea capacity runs north to Europe, so Frankfurt is the
shortest real path from Windhoek — Oregon and Virginia are materially worse, and
Render has no African region. Expect roughly 150–200 ms, which is fine for a
workshop application and noticeable only if a screen makes many sequential
round-trips.

## The one sequencing rule

**Row-level security must not be forced until the application sets
`motion.tenant_id`.** Render's Postgres user *owns* the tables and is not a
superuser, and `FORCE ROW LEVEL SECURITY` binds owners. Forced policies with no
tenant set mean every query matches nothing and MOTION comes up with empty
screens — which looks like lost data rather than a permissions mistake.

This was verified, not assumed: a database created, migrated and read by a
non-superuser owner returned zero rows. Migration
`20260922170000_rls_defer_force` stands FORCE down for exactly this reason, so
the `security/rls` branch is now safe to merge and deploy. The policies remain
enabled and still bind every role that does not own the tables.

FORCE comes back in the same change that sets the tenant per transaction.

## Costs

Staging is roughly USD 7 for the web service and USD 6–7 for the database, about
**N$250 a month** at N$18.50. Trivial against the delivery plan's figures, and
worth keeping running rather than tearing down between sessions — a staging
environment you have to rebuild is one you stop using.

## Production, when it comes

Not a different blueprint — the same one with three changes:

- a plan with automatic backups, and **one restore rehearsed** before a real
  workshop is on it;
- a custom domain with TLS;
- `security/rls` merged *and* activated, so the wall between two workshops'
  books is held by the database and not only by the application.

Until that third point is done, one tenancy bug shows one workshop another's
customers, prices and debtors. On staging that is embarrassing. In production it
is the end of the business.
