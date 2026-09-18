import { test } from "node:test";
import assert from "node:assert/strict";
import { decisionError, estimates, rag, stateAfterDecisions, toConvert, type ItemLike } from "./rules";

const item = (over: Partial<ItemLike> = {}): ItemLike => ({ urgent: false, soon: false, checked: true, estimate: null, approvedAt: null, declinedAt: null, documentLineId: null, ...over });

test("RAG is two flags, and urgent wins when both are set", () => {
    assert.equal(rag(item({ urgent: true, soon: true })), "red");
    assert.equal(rag(item({ soon: true })), "amber");
    assert.equal(rag(item()), "green");
    assert.equal(rag(item({ checked: false })), "unchecked");
});

test("a requested inspection settles only when every red and amber finding has an answer", () => {
    const brake = item({ urgent: true, estimate: 1850 });
    const wiper = item({ soon: true, estimate: 240 });
    const tyres = item();
    assert.equal(stateAfterDecisions("REQUESTED", [brake, wiper, tyres]), "REQUESTED");
    assert.equal(stateAfterDecisions("REQUESTED", [{ ...brake, approvedAt: new Date() }, wiper, tyres]), "REQUESTED");
    assert.equal(stateAfterDecisions("REQUESTED", [{ ...brake, approvedAt: new Date() }, { ...wiper, declinedAt: new Date() }, tyres]), "APPROVED");
    assert.equal(stateAfterDecisions("REQUESTED", [{ ...brake, declinedAt: new Date() }, { ...wiper, declinedAt: new Date() }]), "REFUSED");
});

test("drafts and finalised inspections are not moved by decisions", () => {
    const yes = item({ urgent: true, approvedAt: new Date() });
    assert.equal(stateAfterDecisions("DRAFT", [yes]), "DRAFT");
    assert.equal(stateAfterDecisions("FINALISED", [yes]), "FINALISED");
});

test("the customer sees urgent and soon totalled separately", () => {
    const e = estimates([item({ urgent: true, estimate: 1850 }), item({ urgent: true, estimate: 420.5 }), item({ soon: true, estimate: 240, approvedAt: new Date() }), item({ estimate: 99 })]);
    assert.deepEqual(e, { urgent: 2270.5, soon: 240, approved: 240 });
});

test("a finding already on the job card cannot be changed by a later tap", () => {
    assert.match(decisionError("APPROVED", item({ urgent: true, approvedAt: new Date(), documentLineId: "l1" })) ?? "", /already on the job card/);
    assert.match(decisionError("DRAFT", item({ urgent: true })) ?? "", /not been sent/);
    assert.match(decisionError("REQUESTED", item()) ?? "", /Only red and amber/);
    assert.equal(decisionError("REQUESTED", item({ soon: true })), null);
});

test("only approved findings not yet on the job card are converted", () => {
    const items = [item({ urgent: true, approvedAt: new Date() }), item({ urgent: true, approvedAt: new Date(), documentLineId: "l1" }), item({ soon: true, declinedAt: new Date() })];
    assert.equal(toConvert(items).length, 1);
});
