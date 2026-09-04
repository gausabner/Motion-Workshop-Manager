# MOTION Workshop Manager

Multi-tenant workshop management for automotive and mechanical workshops — Namibia first, South Africa second. Benchmarked against Workshop Software; see [PRD.md](PRD.md) and [docs/benchmark](docs/benchmark/workshop-software-feature-inventory.md).

## Stack

One codebase: **Next.js 16** (App Router, server actions) + **Prisma 6** on **PostgreSQL 15**. Session auth with bcrypt and an httpOnly cookie; every tenant-owned query goes through `forTenant()` so it cannot leave the workshop's rows.

```
web/            the app (src/app routes, src/lib domain code, prisma/ schema + migrations)
docs/           PRD evidence and benchmark
References/     saved pages of the benchmark product (not shipped)
```

## Run it locally

Prerequisites: Node 24, Docker Desktop.

```bash
docker compose up -d db                 # Postgres on :5432
cd web && cp .env.example .env          # set SESSION_SECRET (openssl rand -hex 32)
npm install                             # also runs prisma generate
npm run db:migrate                      # apply migrations
npm run db:seed                         # demo workshop "TipTop AutoCare"
npm run dev                             # http://localhost:3000
```

Sign in as `admin@motion.com` / `admin` → `/tiptop/dashboard`.

## Where things are

| Concern | Path |
|:--|:--|
| Data model (PRD §7) | `web/prisma/schema.prisma` |
| Auth & sessions | `web/src/lib/auth/` |
| Tenant scoping | `web/src/lib/tenant-db.ts` |
| Permissions matrix (PRD USR-02) | `web/src/lib/auth/permissions.ts` |
| Domain modules | `web/src/lib/<module>/{schema,queries,actions}.ts` |
| Route guard | `web/src/proxy.ts` |
