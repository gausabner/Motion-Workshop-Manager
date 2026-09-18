import { test } from "node:test";
import assert from "node:assert/strict";
import { MailtoDriver, WhatsAppLinkDriver } from "./drivers";

test("WhatsApp gets the message typed out, line breaks and all", async () => {
    const result = await new WhatsAppLinkDriver().send({ channel: "WHATSAPP", recipient: "264817444912", body: "Hi Courtney,\nyour invoice: https://x.test/share/abc" });
    assert.equal(result.kind, "handoff");
    if (result.kind !== "handoff") return;
    const url = new URL(result.url);
    assert.equal(url.origin + url.pathname, "https://wa.me/264817444912");
    assert.equal(url.searchParams.get("text"), "Hi Courtney,\nyour invoice: https://x.test/share/abc");
});

test("a number WhatsApp cannot reach is refused before anything opens", async () => {
    const result = await new WhatsAppLinkDriver().send({ channel: "WHATSAPP", recipient: "081 744 4912", body: "x" });
    assert.equal(result.kind, "failed");
});

test("the mail app gets the subject and body, with spaces that stay spaces", async () => {
    const result = await new MailtoDriver().send({ channel: "EMAIL", recipient: "courtney@example.com", subject: "Tax invoice INV-1004", body: "Hi Courtney" });
    assert.equal(result.kind, "handoff");
    if (result.kind !== "handoff") return;
    assert.ok(result.url.startsWith("mailto:courtney%40example.com?"));
    assert.ok(!result.url.includes("+"), "a + would print literally in the mail client");
    assert.match(result.url, /subject=Tax%20invoice%20INV-1004/);
    assert.match(result.url, /body=Hi%20Courtney/);
});

test("an address that is not an address is refused", async () => {
    const result = await new MailtoDriver().send({ channel: "EMAIL", recipient: "not-an-email", body: "x" });
    assert.equal(result.kind, "failed");
});
