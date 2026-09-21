# File storage

Uploaded files — EFT proofs of payment today, job-card photos and signed
authorisations next — go through one interface, and a deployment chooses where
the bytes actually land. One codebase serves a workshop running on a single
machine and a workshop on object storage, and a workshop that moves from the
first to the second keeps everything it already had.

## The contract

`StorageDriver` in [`web/src/lib/storage/types.ts`](../web/src/lib/storage/types.ts) is four
methods: `put`, `get`, `delete`, `exists`. Nothing that stores or reads a file
knows which driver it is talking to.

Keys are built by `buildKey()` and are always
`t/<tenant>/<owner type>/<owner>/<id>.<ext>`, so one workshop's files are one
subtree. Key rules are enforced before a key ever becomes a path or a URL:
lowercase, no `..`, no leading or doubled slash, nothing that could climb out of
its prefix.

## The two drivers

| | `local` | `s3` |
|---|---|---|
| Set with | `STORAGE_DRIVER=local` (default) | `STORAGE_DRIVER=s3` |
| Where | disk, under `STORAGE_LOCAL_ROOT` | any S3-compatible bucket |
| Good for | one machine, one workshop, getting started | several app instances, backups, growth |
| Works with | — | AWS S3, Cloudflare R2, MinIO, Backblaze B2, DigitalOcean Spaces |

`.env.example` lists every variable each one reads.

## Why switching is safe

**Every attachment records the driver that wrote it** (`Attachment.driver`).
Reads go through `driverNamed(attachment.driver)`, not through whatever the
deployment is configured with now. So:

- flipping `STORAGE_DRIVER` changes where *new* files go, and nothing else;
- files written before the switch keep resolving, with no backfill and no
  downtime;
- running both at once — mid-migration, or because one tenant's files were
  seeded from an import — is a supported state rather than an accident.

There is no "migrate the files" step to get wrong, because there is no step.

## Serving

Files are private. They are never exposed at a public URL: every read goes
through `/{tenant}/attachments/{id}`, which requires a session and uses the
tenant-scoped Prisma client, so one workshop asking for another's file gets a
404 — the same answer as a file that does not exist. Responses carry
`X-Content-Type-Options: nosniff` and only the handful of types in
`ALLOWED_TYPES` can ever be stored.

## What is proven, and what is not

- The `local` driver is exercised against a real disk: round-trip with a
  checksum match, cross-tenant reads refused, and four path-traversal shapes
  refused by the key rules rather than by luck.
- SigV4 signing is checked step by step against the worked example AWS
  publishes — canonical request, string to sign, signing key and the final
  `Authorization` header all match.
- **The `s3` driver has not yet been run against a real bucket.** The signing
  is right; the request shaping (virtual-hosted vs path style, endpoint
  handling) needs one smoke test against the chosen provider before anything
  depends on it in production.
