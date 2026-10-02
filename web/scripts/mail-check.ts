/**
 * Does mail actually work from here?
 *
 * The first thing that goes wrong with SMTP is the login, and the second is a
 * DNS record that was pasted with a character missing. Both are silent: the app
 * builds, the page renders, and the only symptom is a password reset that never
 * arrives — reported by somebody who is locked out and cannot tell you much.
 *
 * So this checks the two of them on purpose, before anybody needs it:
 *
 *   npm run mail:check                  — credentials and DNS
 *   npm run mail:check you@example.com  — and send a real one there
 *
 * It opens an SMTP connection and authenticates without sending (nodemailer's
 * `verify`), and it resolves the records that decide whether what you do send is
 * believed. Sending is opt-in because a bounce costs the domain reputation, so
 * it should be an address you own and chose.
 *
 * `.env` is loaded by the npm script rather than here. An `import` is hoisted
 * above any statement in this file, so anything read at module load in what it
 * pulls in would see the environment before a `loadEnvFile` call could run.
 */

import { Resolver } from "node:dns/promises";
import { sendMail, verifyMail } from "@/lib/mail/send";

const CHECK = "✓";
const CROSS = "✗";
const WARN = "•";

let failed = false;

function pass(label: string, detail = "") {
    console.log(`  ${CHECK} ${label}${detail ? `  ${detail}` : ""}`);
}

function fail(label: string, detail: string) {
    failed = true;
    console.log(`  ${CROSS} ${label}  ${detail}`);
}

/**
 * Not a pass and not a failure: the question could not be asked.
 *
 * This exists because the first version of this script did not have it, and
 * reported a correctly configured SPF record as missing — the network it ran on
 * answers MX queries and silently drops TXT ones. "There is no record" and "I
 * could not find out" look identical to a caller that only catches, and the
 * first is a line somebody acts on. Nothing here is allowed to conflate them.
 */
function unknown(label: string, detail: string) {
    console.log(`  ${WARN} ${label}  ${detail}`);
}

// ── Asking ───────────────────────────────────────────────────────────────────

/**
 * The public resolvers, not the system one. A record that resolves on this
 * laptop because of a stale cache or a VPN's split DNS is not a record the
 * world can see, and the world is who has to believe this mail.
 */
const resolver = new Resolver({ timeout: 5_000, tries: 2 });
resolver.setServers(["1.1.1.1", "8.8.8.8"]);

type Answer =
    /** The resolver answered. An empty list is a real answer: there is no such record. */
    | { ok: true; records: string[]; via: "dns" | "https" }
    /** Nobody answered. Says nothing about whether the record exists. */
    | { ok: false; why: string };

/**
 * Port 53, then the same question over HTTPS.
 *
 * Captive portals, hotspots and hotel networks interfere with DNS in ways that
 * are hard to predict and easy to misread — dropping TXT while passing MX is a
 * real example, met while writing this. DNS-over-HTTPS goes through whatever
 * lets the rest of this script reach an SMTP server, so it is the fallback
 * rather than a second guess at the same thing.
 */
async function lookup(name: string, type: "TXT" | "MX"): Promise<Answer> {
    try {
        const records =
            type === "TXT"
                ? // A long value arrives as several strings and is rejoined with
                  // nothing between them — that is how a >255-byte DKIM key is
                  // carried, so splitting on the chunks would break every one.
                  (await resolver.resolveTxt(name)).map((chunks) => chunks.join(""))
                : (await resolver.resolveMx(name)).map((r) => `${r.priority} ${r.exchange}`);
        return { ok: true, records, via: "dns" };
    } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        // These two mean the resolver did answer, and the answer was "nothing".
        if (code === "ENODATA" || code === "ENOTFOUND") return { ok: true, records: [], via: "dns" };
        return await lookupOverHttps(name, type, code ?? "failed");
    }
}

async function lookupOverHttps(name: string, type: "TXT" | "MX", why: string): Promise<Answer> {
    try {
        const response = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`, {
            headers: { accept: "application/dns-json" },
            signal: AbortSignal.timeout(8_000),
        });
        if (!response.ok) return { ok: false, why: `port 53 ${why}, and DNS-over-HTTPS returned ${response.status}` };
        const body = (await response.json()) as { Status?: number; Answer?: { data?: string }[] };
        // 0 is NOERROR and 3 is NXDOMAIN; both are answers. Anything else
        // (SERVFAIL especially) is the resolver declining to say.
        if (body.Status !== 0 && body.Status !== 3) return { ok: false, why: `port 53 ${why}, and DNS-over-HTTPS replied with status ${body.Status}` };
        const records = (body.Answer ?? [])
            .map((a) => a.data ?? "")
            // The JSON form quotes each string of a TXT record and keeps the
            // segment boundaries, so the quotes come out and the rest joins up.
            .map((data) => (type === "TXT" ? data.replace(/" *"/g, "").replace(/^"|"$/g, "") : data.replace(/\.$/, "")))
            .filter(Boolean);
        return { ok: true, records, via: "https" };
    } catch (error) {
        return { ok: false, why: `port 53 ${why}, and DNS-over-HTTPS ${error instanceof Error ? error.message : "failed"}` };
    }
}

// ── Checking ─────────────────────────────────────────────────────────────────

/** Records are published per domain, which is the From address's domain — not the mailbox that logs in. */
function sendingDomain(): string | undefined {
    return process.env.MAIL_FROM?.trim().split("@")[1]?.toLowerCase();
}

async function checkDns(domain: string) {
    console.log(`\nDNS for ${domain}`);

    const mx = await lookup(domain, "MX");
    if (!mx.ok) unknown("MX", mx.why);
    else if (!mx.records.length) fail("MX", "no records — the domain cannot receive mail");
    else pass("MX", mx.records.join(", "));

    const apex = await lookup(domain, "TXT");
    if (!apex.ok) unknown("SPF", apex.why);
    else {
        const spf = apex.records.filter((v) => v.toLowerCase().startsWith("v=spf1"));
        if (!spf.length) fail("SPF", "no v=spf1 record at the apex");
        // Not a style note: SPF permanently fails when a domain publishes two,
        // so this is worse than having none and is easy to do by adding one
        // rather than editing the one that is there.
        else if (spf.length > 1) fail("SPF", `${spf.length} records — SPF permanently fails when there is more than one`);
        else pass("SPF", spf[0]);
    }

    // The selector is the provider's, not a standard. Private Email signs as
    // `privateemail`; the common default elsewhere is `default`, so both are
    // tried before this is called missing.
    const selectors = (process.env.MAIL_DKIM_SELECTORS?.trim() || "privateemail,default").split(",").map((s) => s.trim()).filter(Boolean);
    let reported = false;
    let asked = true;
    for (const selector of selectors) {
        const answer = await lookup(`${selector}._domainkey.${domain}`, "TXT");
        if (!answer.ok) {
            asked = false;
            continue;
        }
        const found = answer.records.find((v) => v.toLowerCase().includes("p="));
        if (!found) continue;
        reported = true;
        // A key pasted short still answers DNS and still fails every signature,
        // which is the hardest version of this to diagnose from the symptom.
        const key = /p=([A-Za-z0-9+/=]*)/.exec(found)?.[1] ?? "";
        if (key.length < 200) fail(`DKIM (${selector})`, `public key is only ${key.length} characters — it looks truncated`);
        else pass(`DKIM (${selector})`, `${key.length}-character key`);
        break;
    }
    if (!reported) {
        const where = selectors.map((s) => `${s}._domainkey`).join(" or ");
        if (asked) fail("DKIM", `no key at ${where}`);
        else unknown("DKIM", `could not resolve ${where}`);
    }

    const dmarc = await lookup(`_dmarc.${domain}`, "TXT");
    if (!dmarc.ok) unknown("DMARC", dmarc.why);
    else {
        const record = dmarc.records.find((v) => v.toLowerCase().startsWith("v=dmarc1"));
        if (!record) fail("DMARC", "no record at _dmarc — mail is deliverable but unmonitored");
        else pass("DMARC", record);
    }
}

async function main() {
    const to = process.argv[2];

    console.log("Credentials");
    try {
        await verifyMail();
        pass("SMTP login", `${process.env.MAIL_SMTP_HOST}:${process.env.MAIL_SMTP_PORT || "465"} as ${process.env.MAIL_SMTP_USER}`);
    } catch (error) {
        fail("SMTP login", error instanceof Error ? error.message : String(error));
    }

    const domain = sendingDomain();
    if (!domain) fail("MAIL_FROM", "not set, so there is no domain to check");
    else await checkDns(domain);

    if (to) {
        console.log("\nTest message");
        try {
            await sendMail({
                to,
                subject: "MOTION mail check",
                text: "If you are reading this, MOTION can send mail.\n\nCheck the headers for dkim=pass and spf=pass — arriving is not the same as being trusted.",
            });
            pass("sent", to);
        } catch (error) {
            fail("send", error instanceof Error ? error.message : String(error));
        }
    } else {
        console.log("\nPass an address to send a real test message there.");
    }

    // A non-zero exit so this is usable as a deployment gate, not only read by
    // a human who may skim past a cross. A `${WARN}` line never sets it: a check
    // that could not run is not a reason to block a deploy, and treating it as
    // one is how a gate gets switched off.
    if (failed) process.exitCode = 1;
}

// Not top-level `await`: the package is CommonJS, so tsx compiles this file as
// CJS and esbuild rejects it. The exit code is still honoured, because it is
// set before the event loop drains.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
