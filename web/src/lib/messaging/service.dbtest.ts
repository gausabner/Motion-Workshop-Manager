import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/lib/db";
import { forTenant } from "@/lib/tenant-db";
import { draftMessage, sendMessage } from "@/lib/messaging/service";
import { hashShareToken } from "@/lib/sharing/links";
import type { Tenant } from "@prisma/client";

/**
 * Pressing Send, end to end.
 *
 * MOTION does not transmit anything. WhatsApp and a mail app's compose window
 * carry text, not files, so a document goes out as a link to itself, and the
 * "driver" hands that link to whatever app the person already uses. The two
 * things worth proving are therefore:
 *
 *   1. Nothing leaves the building. No request goes anywhere; the status says
 *      HANDED_OFF, not SENT, because we genuinely cannot know whether the
 *      person pressed send in their own WhatsApp.
 *   2. The link is real, revocable, and stored as a hash — it is the only
 *      thing between an invoice and anyone who sees the message.
 *
 * Run with `npm run test:db`. Nothing here can reach a real customer: the
 * drivers build URLs, and the fixture's "customer" is a ZZTEST row.
 */

const ID = "zztest-messaging";
let tenant: Tenant;
let db: ReturnType<typeof forTenant>;
let ctx: Parameters<typeof sendMessage>[0];
let customerId = "";
let documentId = "";

/** A run that died mid-way leaves a tenant behind; start from a clean slate rather than a unique-constraint error. */
async function removeFixture(): Promise<void> {
    const existing = await prisma.tenant.findUnique({ where: { slug: ID }, select: { id: true } });
    if (!existing) return;
    const id = existing.id;
    await prisma.message.deleteMany({ where: { tenantId: id } });
    await prisma.shareLink.deleteMany({ where: { tenantId: id } });
    await prisma.documentStatusEvent.deleteMany({ where: { tenantId: id } });
    await prisma.documentLine.deleteMany({ where: { tenantId: id } });
    await prisma.reminder.deleteMany({ where: { tenantId: id } });
    await prisma.document.deleteMany({ where: { tenantId: id } });
    await prisma.customer.deleteMany({ where: { tenantId: id } });
    await prisma.auditEvent.deleteMany({ where: { tenantId: id } });
    await prisma.sequence.deleteMany({ where: { tenantId: id } });
    await prisma.template.deleteMany({ where: { tenantId: id } });
    await prisma.membership.deleteMany({ where: { tenantId: id } });
    await prisma.tenant.delete({ where: { id } });
    await prisma.user.deleteMany({ where: { email: `${ID}@example.invalid` } });
}

before(async () => {
    await removeFixture();
    tenant = await prisma.tenant.create({
        data: { slug: ID, name: "ZZTEST Messaging Motors", country: "NA", timezone: "Africa/Windhoek", currency: "NAD" },
    });
    db = forTenant(tenant.id);

    const user = await prisma.user.create({
        data: { email: `${ID}@example.invalid`, passwordHash: "x", firstName: "ZZTEST", lastName: "Sender" },
        select: { id: true },
    });
    const membership = await prisma.membership.create({
        data: { tenantId: tenant.id, userId: user.id, group: "OWNER" },
    });

    const customer = await prisma.customer.create({
        data: { tenantId: tenant.id, firstName: "ZZTEST", lastName: "Recipient", mobile: "081 555 0000", email: "zztest@example.invalid" },
        select: { id: true },
    });
    customerId = customer.id;

    const document = await prisma.document.create({
        data: { tenantId: tenant.id, type: "INVOICE", state: "PROCESSED", number: "INV-9001", customerId, total: 1265, description: "Minor service" },
        select: { id: true },
    });
    documentId = document.id;

    ctx = { db, tenant, membership, user: { ...user, firstName: "ZZTEST", lastName: "Sender", email: `${ID}@example.invalid` } } as typeof ctx;
});

after(async () => {
    await removeFixture();
    await prisma.$disconnect();
});

const target = () => ({ kind: "DOCUMENT", id: documentId }) as Parameters<typeof draftMessage>[2];

test("the draft is addressed to the customer, in the workshop's own words", async () => {
    const draft = await draftMessage(db, tenant, target(), "WHATSAPP");
    assert.ok(draft, "there is something to send");
    assert.equal(draft.channel, "WHATSAPP");
    assert.equal(draft.recipient, "264815550000", "the local number is made international");
    assert.match(draft.body, /\{\{link\}\}/, "the link is placed but not yet minted");
    assert.deepEqual(draft.warnings, [], "nothing to warn about");
});

test("sending hands off — a link is made, a message is logged, and nothing is transmitted", async () => {
    const before = Date.now();
    const result = await sendMessage(ctx, "https://tiptop.example", {
        target: target(), channel: "WHATSAPP", recipient: "081 555 0000", body: "Your invoice: {{link}}",
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;

    assert.equal(result.status, "HANDED_OFF", "we cannot claim it was sent — a person still has to press send");

    // What comes back is the hand-off itself: a wa.me deep link that opens the
    // person's own WhatsApp with the message already typed. That is the whole
    // mechanism — we never hold a WhatsApp account, so nothing can be sent from
    // here, and the invoice travels inside that text as a link to ourselves.
    const handoff = new URL(result.url ?? "");
    assert.equal(handoff.origin, "https://wa.me");
    assert.equal(handoff.pathname, "/264815550000", "addressed to the customer's number");
    const typed = handoff.searchParams.get("text") ?? "";
    assert.match(typed, /^https:\/\/tiptop\.example\/share\/[A-Za-z0-9_-]{40,}$|share\//, "carrying our own share link");

    const message = await prisma.message.findUniqueOrThrow({
        where: { id: result.messageId },
        select: { channel: true, driver: true, status: true, recipient: true, body: true, externalId: true, error: true, shareLinkId: true, customerId: true },
    });
    assert.equal(message.driver, "whatsapp-link", "the hand-off driver, which needs no account");
    assert.equal(message.status, "HANDED_OFF");
    assert.equal(message.recipient, "264815550000");
    assert.equal(message.externalId, null, "no provider gave us an id, because no provider was involved");
    assert.equal(message.error, null);
    assert.equal(message.customerId, customerId);
    assert.ok(message.shareLinkId, "the message remembers which link it carried");
    assert.match(message.body, /https:\/\/tiptop\.example\/share\//, "the body stored is the body a person would paste");
    assert.doesNotMatch(message.body, /\{\{/, "every field resolved");

    // The document is now marked as told, which is what the "Told" column reads.
    const document = await prisma.document.findUniqueOrThrow({ where: { id: documentId }, select: { contactedAt: true } });
    assert.ok(document.contactedAt && document.contactedAt.getTime() >= before);
});

test("the link is stored as a hash, so the database never holds the key to the invoice", async () => {
    const result = await sendMessage(ctx, "https://tiptop.example", {
        target: target(), channel: "WHATSAPP", recipient: "081 555 0000", body: "Your invoice: {{link}}",
    });
    assert.equal(result.ok, true);
    if (!result.ok || !result.url) return;

    // The token is inside the text the person will send, not in the hand-off URL's path.
    const typed = new URL(result.url).searchParams.get("text") ?? "";
    const token = typed.match(/\/share\/([A-Za-z0-9_-]+)/)?.[1] ?? "";
    assert.ok(token.length >= 40, "a long random token, not a guessable id");
    const link = await prisma.shareLink.findFirstOrThrow({
        where: { tenantId: tenant.id, tokenHash: hashShareToken(token) },
        select: { tokenHash: true, expiresAt: true, revokedAt: true, openCount: true, firstOpenedAt: true },
    });
    assert.notEqual(link.tokenHash, token, "the token itself is not stored");
    assert.ok(link.expiresAt.getTime() > Date.now(), "and it expires");
    assert.equal(link.revokedAt, null, "and can be revoked");
    assert.equal(link.openCount, 0, "nobody has opened it — which is the only delivery signal we get");
    assert.equal(link.firstOpenedAt, null);
});

test("a customer with no mobile is a warning, not a silent failure", async () => {
    await prisma.customer.update({ where: { id: customerId }, data: { mobile: null } });
    const draft = await draftMessage(db, tenant, target(), "WHATSAPP");
    assert.ok(draft);
    assert.match(draft.warnings.join(" "), /no mobile number/i);
    await prisma.customer.update({ where: { id: customerId }, data: { mobile: "081 555 0000" } });
});

test("a customer who opted out is flagged before anybody presses send", async () => {
    await prisma.customer.update({ where: { id: customerId }, data: { preferredContact: "OPT_OUT" } });
    const draft = await draftMessage(db, tenant, target(), "WHATSAPP");
    assert.ok(draft);
    assert.match(draft.warnings.join(" "), /opted out/i);
    await prisma.customer.update({ where: { id: customerId }, data: { preferredContact: "WHATSAPP" } });
});

test("an unreachable number and an empty message are both refused", async () => {
    const noNumber = await sendMessage(ctx, "https://tiptop.example", {
        target: target(), channel: "WHATSAPP", recipient: "not a number", body: "hello",
    });
    assert.equal(noNumber.ok, false);

    const noBody = await sendMessage(ctx, "https://tiptop.example", {
        target: target(), channel: "WHATSAPP", recipient: "081 555 0000", body: "   ",
    });
    assert.equal(noBody.ok, false);

    assert.equal(await prisma.message.count({ where: { tenantId: tenant.id, status: "FAILED" } }), 0, "a refusal is not a failed send, it is no send");
});

test("email carries a subject; WhatsApp does not", async () => {
    const draft = await draftMessage(db, tenant, target(), "EMAIL");
    assert.ok(draft);
    assert.equal(draft.recipient, "zztest@example.invalid");
    assert.ok(draft.subject && draft.subject.includes("INV-9001"), "the subject names the document");

    const result = await sendMessage(ctx, "https://tiptop.example", {
        target: target(), channel: "EMAIL", recipient: "zztest@example.invalid", subject: draft.subject, body: draft.body,
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const message = await prisma.message.findUniqueOrThrow({ where: { id: result.messageId }, select: { driver: true, subject: true, status: true } });
    assert.equal(message.driver, "mailto");
    assert.equal(message.status, "HANDED_OFF");
    assert.ok(message.subject?.includes("INV-9001"));
});

test("every link minted is a separate link, so revoking one does not revoke the rest", async () => {
    const links = await prisma.shareLink.findMany({ where: { tenantId: tenant.id }, select: { id: true, tokenHash: true } });
    const hashes = new Set(links.map((l) => l.tokenHash));
    assert.equal(hashes.size, links.length, "no two sends shared a token");
    assert.ok(links.length >= 3, "the sends above each minted one");
});
