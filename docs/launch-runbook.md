# Launch runbook

Taking MOTION from a blank server to a workshop using it. Written against the
server that exists, not a generic one.

| | |
| --- | --- |
| **Host** | Namecheap VPS Quasar — 4 vCPU, 6 GB, 120 GB NVMe, KVM |
| **IP** | `162.0.239.92`, no IPv6 allocated |
| **Hostname** | `server1.motionworkshopmanager.com` |
| **OS** | AlmaLinux 9, no control panel |
| **Where** | Phoenix, Arizona. Namecheap support confirmed VPS plans are US-only; the EU datacentre is shared-hosting only |
| **Domain** | `motionworkshopmanager.com`, registered at Namhost 1 Oct 2026, locked, auto-renewing |
| **DNS** | Cloudflare |
| **Billing** | Monthly, renewing 31 October |

---

## The latency, stated plainly before anything else

Measured from Windhoek to this server: **380 ms round trip.** The traceroute
leaves on Telecom Namibia, is still inside Africa at 83 ms, reaches Europe
around 250 ms, and arrives in Phoenix at 380 ms. The origin cannot be moved —
Namecheap does not offer a European VPS — so the architecture below is built
to make the distance matter as little as it can.

What the Cloudflare layer removes:

- **Connection setup.** TLS and HTTP/3 terminate at Cloudflare's Johannesburg
  or Cape Town edge, roughly 80 ms away. That takes three or four round trips
  off every new connection — call it a second saved on a cold load.
- **Every static asset.** Next.js fingerprints everything under
  `/_next/static/`, so it is immutable and cacheable forever. A page is one
  HTML document and thirty-odd assets; served from the edge, those thirty stop
  crossing the Atlantic at all.
- **Origin connection reuse.** Cloudflare keeps warm connections to the origin,
  so a request pays one 380 ms trip rather than a handshake plus a trip.

What stays: the dynamic HTML or RSC payload still makes one origin round trip.
Expect roughly **1.2–1.5 s for a cold first load and 400–500 ms per
navigation**, with prefetched links feeling instant because the payload was
already fetched on hover. The offline floor app is unaffected — it queues
clock events locally regardless.

> **If this proves too slow in practice**, the real fix is a South African
> origin — Xneelo, Afrihost or RSAWEB would be 80–100 ms from Windhoek, four
> times better, and a stronger data-residency answer for councils than Arizona.
> The Namecheap VPS is monthly with a 30-day money-back window, so that door is
> open until the end of October. Do not reopen it before Saturday; do reopen it
> if the first real user finds the app sluggish.

---

## 1. Cloudflare, first

Nothing else can be tested until the domain resolves, and right now it resolves
nowhere: the registry delegation to `ns1/ns2.triton.namhost.com` is live, but
those nameservers answer **REFUSED** — Namhost only serves zones for its own
hosting customers, and the hosting is at Namecheap. Namhost's dashboard offers
a nameserver field and no zone editor, so this is not something to fix there.

1. Add `motionworkshopmanager.com` to Cloudflare (free plan). Let it scan; it
   will find nothing, which is correct.
2. Copy the two nameservers Cloudflare assigns.
3. Namhost → Domains → `motionworkshopmanager.com` → **Edit Nameservers** →
   replace both. The domain is an hour old, so nothing is cached against you.
4. Wait for Cloudflare to report the zone active, then confirm from a terminal
   rather than from the dashboard:

   ```bash
   dig +short NS motionworkshopmanager.com
   dig @1.1.1.1 +short SOA motionworkshopmanager.com
   ```

5. In Cloudflare: **SSL/TLS → Full (strict)**, **Always Use HTTPS on**,
   **Minimum TLS 1.2**, **HTTP/3 on**, **Brotli on**.

Do not create an A record for the apex. The tunnel in step 4 creates its own
proxied record, and an A record pointing at `162.0.239.92` would publish the
origin IP that the tunnel exists to hide.

## 2. Lock the account and the box

> **Reaching the box.** `server1.motionworkshopmanager.com` is the machine's own
> hostname and **not** a DNS record — nothing resolves it, because web traffic
> arrives through the Cloudflare Tunnel rather than to the server, so the host
> has no public A record at all. SSH goes to the address directly. `~/.ssh/config`
> on the admin laptop carries both:
>
> ```
> Host motion-root        # root, for /etc/motion and systemd
>     HostName 162.0.239.92
>     User root
>     IdentityFile ~/.ssh/motion_server1
>
> Host motion-server1     # the unprivileged day-to-day login
>     HostName 162.0.239.92
>     User motion
>     IdentityFile ~/.ssh/motion_server1
> ```
>
> So it is `ssh motion-root`, not `ssh root@server1.…`.

**Namecheap two-factor is currently OFF.** That account holds a *Reinstall*
button that wipes this server. Turn it on before anything of value is on the
machine — the dashboard offers a TOTP app, which is the right choice over SMS.

Then, from your laptop:

```bash
ssh-keygen -t ed25519 -C "motion-server1" -f ~/.ssh/motion_server1
ssh-copy-id -i ~/.ssh/motion_server1.pub root@162.0.239.92
```

On the server, once key login is confirmed working **in a second terminal you
keep open** — locking yourself out of a box with no console is a bad afternoon:

```bash
dnf -y update
dnf -y install firewalld fail2ban postgresql git
systemctl enable --now firewalld fail2ban

useradd -m -G wheel motion
mkdir -p /home/motion/.ssh && cp /root/.ssh/authorized_keys /home/motion/.ssh/
chown -R motion:motion /home/motion/.ssh && chmod 700 /home/motion/.ssh

sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/;s/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sshd -t && systemctl restart sshd

firewall-cmd --permanent --remove-service=cockpit 2>/dev/null
firewall-cmd --reload
firewall-cmd --list-all
```

Note what is *not* opened: 80 and 443 stay shut. The tunnel dials out. The only
inbound port on this server is SSH, which is the same posture the security
whitepaper already claims for installed sites.

`postgresql` is installed for the client tools alone — `pg_dump`, `pg_restore`
and `psql`, which the backup scripts use. The server itself runs in a
container.

## 3. Docker

AlmaLinux 9 is RHEL-family, so this is the CentOS repository rather than the
Ubuntu one:

```bash
dnf -y install dnf-plugins-core
dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
dnf -y install docker-ce docker-ce-cli containerd.io docker-compose-plugin
systemctl enable --now docker
usermod -aG docker motion
docker compose version
```

## 4. The tunnel

In Cloudflare → **Zero Trust → Networks → Tunnels → Create a tunnel**, named
`motion-server1`. Choose Docker as the connector; you want only the **token**
from the command it shows, not the command itself — compose runs the container.

Add two public hostnames on that tunnel, both pointing at `http://app:3000`:

| Hostname | |
| --- | --- |
| `motionworkshopmanager.com` | the application |
| `www.motionworkshopmanager.com` | redirect, or the same service |

Cloudflare creates the proxied DNS records itself. There is nothing to add by
hand.

## 5. The deployment

```bash
git clone https://github.com/gausabner/MOTION-Workshop-Manager.git /opt/motion
mkdir -p /etc/motion
install -m 600 -o root -g root /opt/motion/ops/server/motion.env.example /etc/motion/motion.env
```

Fill `/etc/motion/motion.env`. Generate the three secrets on the server so they
exist in exactly one place:

```bash
echo "POSTGRES_SUPERUSER_PASSWORD=$(openssl rand -hex 24)"
echo "MOTION_DB_PASSWORD=$(openssl rand -hex 24)"
echo "SESSION_SECRET=$(openssl rand -hex 32)"
```

Paste the tunnel token in as `TUNNEL_TOKEN`.

The image is published to GHCR by the `Image` workflow and the package is
private by default, so the server needs to authenticate once. Use a GitHub
personal access token with `read:packages` only — not a password, and not a
token with write scopes:

```bash
echo "$GHCR_TOKEN" | docker login ghcr.io -u gausabner --password-stdin
```

Then:

```bash
install -m 644 /opt/motion/ops/server/motion.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now motion
docker compose --env-file /etc/motion/motion.env ps
```

What happens on that first start, in order: PostgreSQL initialises and runs
`postgres-init/10-motion-role.sh`, which creates the `motion` role and hands it
the database; the app container waits for the health check, applies every
migration, and starts; the tunnel dials out to Cloudflare and the hostname goes
live.

**Check the init script actually ran**, because this is the one failure here
that wears a disguise. If the container cannot read the mounted directory the
script never executes, the `motion` role is never created, and what you see is
the application failing to authenticate — which looks like a wrong password,
not an unreadable mount. The compose file labels the mount `:ro,z` against
that, which is a no-op on this image because SELinux ships disabled, and
insurance if that ever changes. Either way the line below should appear:

```bash
docker compose --env-file /etc/motion/motion.env logs db | grep "created role motion"
```

If it is missing, the data directory has already initialised without it and
re-running will not help — PostgreSQL only runs init scripts on an empty data
directory. Fix the mount, then `docker compose --env-file /etc/motion/motion.env down -v`
to discard the volume and start again. That is safe now and ruinous later, so
do this check before any real data exists.

### Why the database role matters

The application connects as `motion`, which owns every table but is **not** a
superuser and is **NOBYPASSRLS**. That is not tidiness. Row-level security is
FORCEd on the fifty tables carrying a `tenantId`, which makes the policies bind
even the table owner — but PostgreSQL exempts superusers from RLS
unconditionally, FORCE or not. Running the app as the superuser would dissolve
every tenant boundary in the product silently, with no error and no symptom
until one workshop saw another's books.

This is verified rather than assumed. On a throwaway instance of exactly this
compose file: all 59 tables owned by `motion`, `rolsuper` and `rolbypassrls`
both false, 50 tables with FORCE RLS and 56 policies, a query that has not
announced its tenant returns zero rows, and `motion` is refused when it tries
to grant itself `BYPASSRLS`.

## 6. Prove it is actually up

```bash
curl -fsS https://motionworkshopmanager.com/api/health; echo
docker compose --env-file /etc/motion/motion.env logs --tail 50 app
```

The health endpoint asks PostgreSQL before it answers, so a 200 here means the
whole chain is live. Then stop the database and check it reports 503 — a health
check that cannot fail is decoration, and this one is tested in CI on every
commit for exactly that reason.

## 7. Backups — before the first real customer, not after

Commissioning is not finished until a restore has passed. Full detail in
`ops/backup/README.md`; the shape of it:

1. **Generate the key pair on your laptop, not the server.** The server gets
   only the public half, so it can write backups it cannot read.
2. Create a bucket. Cloudflare R2 is the obvious pick here — you are already in
   that dashboard, and R2 charges nothing for egress, which is what you pay for
   on the day you restore.
3. Fill `/etc/motion/backup.env`, including
   `BACKUP_ATTACHMENTS_DIR=/var/lib/docker/volumes/motion_attachments/_data`,
   and set the client commands to reach the container:
   `PG_DUMP="docker exec -i motion-db-1 pg_dump"` and so on for `pg_dumpall`,
   `pg_restore` and `psql`.
4. `ops/backup/motion-backup.sh`, then enable `motion-backup.timer`.
6. **`ops/backup/motion-verify.sh`.** It restores the night's backup into a
   scratch database and reports how long it took.

   Note the tension to resolve: verification needs the private key *and* the
   database, and those are deliberately on different machines. Running it on
   the server means putting the key there, which is the one thing the design
   avoids. The drill performed at commissioning instead pulled the objects to
   a laptop and restored there — which is a better rehearsal anyway, because
   it proves recovery onto hardware that is not the one that failed. That number is this site's
   recovery time, and it belongs in `docs/continuity-and-recovery.md` in place
   of the generic figure.

## 8. Mail, because a locked-out owner has no other way back

Everything else MOTION sends is a hand-off — a `wa.me` or `mailto:` link the
workshop clicks in their own client. A password reset cannot be: the person who
needs it is locked out and there is nobody on this side to hand it to. That one
path sends for itself over SMTP, through Namecheap Private Email.

Four records on the domain, all in Cloudflare, all **DNS only** (grey cloud —
proxying a TXT or MX record does nothing useful and an orange cloud on the apex
does not affect mail, but the habit is worth keeping):

| Type | Name | Value |
|---|---|---|
| MX | `@` | `10 mx1.privateemail.com`, `10 mx2.privateemail.com` |
| TXT | `@` | `v=spf1 include:spf.privateemail.com ~all` |
| TXT | `privateemail._domainkey` | `v=DKIM1;k=rsa;p=…` — copy from the Private Email dashboard |
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:…; fo=1` |

Three things that are easy to get wrong and silent when you do:

- **The DKIM selector is `privateemail`, not `default`.** Most guides say
  `default`. A key published under the wrong name is a key nobody finds.
- **The DKIM value is longer than 255 bytes**, which is the maximum for a single
  DNS string. Cloudflare splits it for you — paste it whole, and do not add
  quotes or line breaks by hand.
- **Exactly one SPF record.** Two is worse than none: SPF permanently fails, so
  adding a second rather than editing the first breaks what already worked.

Then `/etc/motion/motion.env`, which lives **on the server** and not in this
repository — `motion.env.example` is the template, the real file is deliberately
only ever on the box:

```
ssh motion-root
nano /etc/motion/motion.env
```

```
APP_URL=https://motionworkshopmanager.com
MAIL_DRIVER=smtp
MAIL_SMTP_HOST=mail.privateemail.com
MAIL_SMTP_PORT=465
MAIL_SMTP_USER=no-reply@motionworkshopmanager.com
MAIL_SMTP_PASSWORD=…
MAIL_FROM=no-reply@motionworkshopmanager.com
MAIL_FROM_NAME=MOTION
```

Then `systemctl restart motion`, because the container reads its environment at
start and nothing re-reads this file.

`APP_URL` is **required** — compose refuses to start without it. A reset mail
has no incoming request to infer a host from, so the alternative is a link
nobody can click, and a guessed default would put a wrong address in a mail
somebody is locked out behind.

`MAIL_FROM` is separate from `MAIL_SMTP_USER` on purpose, and must be on the
domain that signs with DKIM — a From address outside it fails alignment and is
spam-filed however correct the records are.

One trap worth knowing if you add settings later: `docker-compose.yml` passes
variables to the app through an explicit `environment:` list, not by handing it
the whole file. A name that is in `motion.env` but not in that list is simply
not there at runtime, with no error anywhere — which is how `APP_URL` came to
be documented as required while being wired nowhere.

Check it before a user does:

```
npm run mail:check                       # credentials and all four records
npm run mail:check you@yourmailbox.com   # and a real message
```

A delivery failure is deliberately invisible to the visitor — it has to be, or
the error page would reveal which addresses are on an account — so a silent
mailbox fails silently. This command is the only thing that notices. Run it
after any DNS change, and read the headers of the test message for `dkim=pass`
and `spf=pass`: arriving is not the same as being trusted.

One standing limit. Private Email is a mailbox, not a transactional service: it
is rate-limited far more aggressively and shares the domain's reputation with
everything else sent from it. It is sized for the handful of resets a day this
produces. Routing bulk invoicing through it is how the domain ends up unable to
send resets either.

## 9. Before Saturday

- [ ] Seed or create the demo workshop, and walk every flow you intend to show.
- [ ] Load the site on a phone over mobile data, not office wifi. That is the
      latency the client will experience, and it is the number that matters.
- [ ] Check the help, pricing and support pages read correctly with the real
      support details from `motion.env`.
- [ ] Confirm the logo and favicon render on the live domain.
- [ ] Pin `MOTION_IMAGE` to a commit SHA rather than `:latest`, so the demo
      cannot change under you between now and the meeting.
- [ ] Have the rollback to hand: change `MOTION_IMAGE` back and
      `systemctl restart motion`. Note the standing constraint — a migration
      that has already run is not undone by starting an older image, so a
      rollback across a schema change needs the database restored to match.

## 10. Shortly after

- **Switch to annual billing.** $12.88/mo against $15.88 is about $36 a year,
  roughly N$590. Worth doing once you are confident you are keeping this box —
  which means after the latency question in the box above is settled.
- **Buy `motionworkshopmanager.com.na`** from Namhost, N$790/yr. A Namibian
  business selling to Namibian councils should hold the Namibian name, if only
  so nobody else does.
- **Move off `gausabner@gmail.com`** to `hello@motionworkshopmanager.com`.
  Create it as a mailbox or alias in Private Email, then update
  `MOTION_SUPPORT_EMAIL` and the support page. Not Cloudflare Email Routing,
  which this runbook used to suggest: Email Routing takes over the domain's MX
  records, so switching it on would stop Private Email receiving anything and
  take the reset mailbox down with it.
- **Decide on monitoring.** The uptime figure in the terms is still blank
  because nothing measures it. A free external check hitting `/api/health`
  every minute would close that, and gives the backup heartbeat somewhere to
  report.

---

## What this does not cover

- **No staging environment.** `render.yaml` describes one on Render and it is
  worth standing up before the first change lands on a live workshop, but it is
  not on the path to Saturday.
- **No failover.** One server. Recovery is restore-and-start, which is the
  honest position `docs/continuity-and-recovery.md` already takes.
- **No email sending from this box.** Its reverse DNS is Namecheap's default
  and nothing would reach an inbox. Use a provider when transactional mail
  becomes real.
