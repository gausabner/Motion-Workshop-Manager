# MOTION, as it runs anywhere that is not a laptop.
#
# One image, any host: a VPS in Windhoek, Fly, Railway, Render, Cloud Run. The
# app needs a Postgres and six environment variables, and nothing else — which
# is deliberate, because a workshop's data should never be somewhere we cannot
# move it from.
#
# Three stages so the thing that ships carries no compiler, no npm cache and no
# source: deps (install), build (compile), runtime (run).

# ── deps ──────────────────────────────────────────────────────────────────
FROM node:24-alpine AS deps
WORKDIR /app
# Prisma's engines need this on musl.
RUN apk add --no-cache openssl
COPY package.json package-lock.json ./
COPY prisma ./prisma
# `npm ci` runs the postinstall that generates the Prisma client, so the schema
# has to be here first.
RUN npm ci

# ── prod-deps ─────────────────────────────────────────────────────────────
# The Prisma CLI, with the dependency tree it actually needs. Hand-picking a
# few packages looked tidy and failed at boot: the CLI reaches for more of its
# own tree than is obvious, and finding that out in a container is slower than
# letting npm work it out here.
FROM node:24-alpine AS proddeps
WORKDIR /app
RUN apk add --no-cache openssl
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev

# ── build ─────────────────────────────────────────────────────────────────
FROM node:24-alpine AS build
WORKDIR /app
RUN apk add --no-cache openssl
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# A build-time placeholder: nothing connects during `next build`, but Prisma
# refuses to load without something shaped like a URL.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public"
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate && npm run build

# ── runtime ───────────────────────────────────────────────────────────────
FROM node:24-alpine AS runtime
WORKDIR /app
RUN apk add --no-cache openssl
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Nothing here runs as root.
RUN addgroup -g 1001 -S nodejs && adduser -u 1001 -S motion -G nodejs

# The standalone server, and the assets it serves.
COPY --from=build --chown=motion:nodejs /app/.next/standalone ./
COPY --from=build --chown=motion:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=motion:nodejs /app/public ./public

# Migrations run at start, so the schema and the code always land together.
# The CLI lives in its own tree rather than merged into the standalone server's
# node_modules, which Next traced precisely and should be left alone.
COPY --from=build --chown=motion:nodejs /app/prisma ./prisma
COPY --from=proddeps --chown=motion:nodejs /app/node_modules ./migrate/node_modules
COPY --from=proddeps --chown=motion:nodejs /app/prisma ./migrate/prisma
COPY --chown=motion:nodejs docker-entrypoint.sh ./

# Attachments when a deployment has no object storage yet. Mount a volume here,
# or set STORAGE_DRIVER=s3 and this stays empty.
RUN mkdir -p /app/.data/attachments && chown -R motion:nodejs /app/.data
VOLUME ["/app/.data"]

USER motion
EXPOSE 3000

# The app is only useful when it can reach the database, so that is what is checked.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>r.json()).then(b=>process.exit(b.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
