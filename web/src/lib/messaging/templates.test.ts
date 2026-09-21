import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_MESSAGES, emailSubject, ensureLink, MESSAGE_PURPOSES, purposeForDocument } from "./templates";
import { renderTemplate, unknownFields } from "@/lib/templates/merge";

test("every default message carries the link and uses only known fields", () => {
    for (const purpose of MESSAGE_PURPOSES) {
        const body = DEFAULT_MESSAGES[purpose];
        assert.match(body, /\{\{link\}\}/, `${purpose} has no link`);
        assert.deepEqual(unknownFields(body), [], `${purpose} uses an unknown field`);
    }
});

test("a settled invoice's message drops the amount-due line rather than saying N$ 0.00", () => {
    const message = renderTemplate(DEFAULT_MESSAGES.INVOICE, {
        customer_first_name: "Courtney",
        document_number: "INV-1003",
        workshop_name: "TipTop AutoCare",
        total: "N$ 2,450.00",
        amount_due: "",
        link: "https://motion.example/share/abc",
    });
    assert.equal(
        message,
        "Hi Courtney, your invoice INV-1003 from TipTop AutoCare is ready: N$ 2,450.00.\nhttps://motion.example/share/abc\nBanking details are on the invoice. Thank you!",
    );
});

test("wording with the link edited out still sends the document", () => {
    assert.equal(ensureLink("Your invoice is ready."), "Your invoice is ready.\n{{link}}");
    assert.equal(ensureLink("See {{ link }} for details."), "See {{ link }} for details.");
});

test("each document type knows which wording it goes out with", () => {
    assert.equal(purposeForDocument("CASH_SALE"), "INVOICE");
    assert.equal(purposeForDocument("BOOKING"), "JOB_CARD");
    assert.equal(purposeForDocument("CREDIT"), "CREDIT");
});

test("the email subject reads as a sentence and skips a missing number", () => {
    assert.equal(emailSubject("Tax invoice", "INV-1004", "TipTop AutoCare"), "Tax invoice INV-1004 from TipTop AutoCare");
    assert.equal(emailSubject("Statement", null, "TipTop AutoCare"), "Statement from TipTop AutoCare");
});
