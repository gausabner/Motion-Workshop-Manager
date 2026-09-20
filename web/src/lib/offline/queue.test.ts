import { test } from "node:test";
import assert from "node:assert/strict";
import { eventProblem, inOrder, SKEW_TOLERANCE_MS, triage, waitingLabel, type ClockEvent } from "./queue";

const now = new Date("2026-09-20T10:00:00Z");
const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString();
const on = (ref: string, at: string, documentId = "job-1"): ClockEvent => ({ kind: "on", ref, at, documentId });
const off = (ref: string, at: string): ClockEvent => ({ kind: "off", ref, at });

test("a tap made an hour ago in a dead spot is accepted at the time it was made", () => {
    assert.equal(eventProblem(on("a", ago(60)), now), null);
    assert.equal(eventProblem(off("b", ago(5)), now), null);
});

test("a phone slightly ahead is tolerated; one dated tomorrow is not", () => {
    const slightlyAhead = new Date(now.getTime() + SKEW_TOLERANCE_MS - 1000).toISOString();
    assert.equal(eventProblem(on("a", slightlyAhead), now), null);
    const wayAhead = new Date(now.getTime() + 60 * 60_000).toISOString();
    assert.match(eventProblem(on("a", wayAhead), now) ?? "", /future/);
});

test("a tap older than a day goes to the counter, not into the books", () => {
    assert.match(eventProblem(on("a", ago(60 * 25)), now) ?? "", /over a day old/);
});

test("a tap with no readable time, no job, or no reference is refused", () => {
    assert.match(eventProblem(on("a", "not a date"), now) ?? "", /readable time/);
    assert.match(eventProblem({ kind: "on", ref: "a", at: ago(5), documentId: "" }, now) ?? "", /which job/);
    assert.match(eventProblem(on("", ago(5)), now) ?? "", /no reference/);
});

test("the queue replays in the order things happened, not the order they arrived", () => {
    const events = [off("third", ago(10)), on("first", ago(60)), on("second", ago(30))];
    assert.deepEqual(inOrder(events).map((e) => e.ref), ["first", "second", "third"]);
});

test("a start and a stop in the same second keep the order they were made in", () => {
    const sameMoment = ago(20);
    const events = [on("start", sameMoment), off("stop", sameMoment)];
    assert.deepEqual(inOrder(events).map((e) => e.ref), ["start", "stop"]);
});

test("triage separates what can be applied from what must be explained", () => {
    const { ready, problems } = triage(
        [on("good", ago(45)), on("future", new Date(now.getTime() + 86_400_000).toISOString()), off("alsoGood", ago(5)), on("ancient", ago(60 * 48))],
        now,
    );
    assert.deepEqual(ready.map((e) => e.ref), ["good", "alsoGood"]);
    assert.deepEqual(problems.map((p) => p.ref).sort(), ["ancient", "future"]);
});

test("the same tap sent twice in one batch is applied once and not complained about", () => {
    const { ready, problems } = triage([on("a", ago(30)), on("a", ago(30))], now);
    assert.equal(ready.length, 1);
    assert.equal(problems.length, 0);
});

test("what is waiting is said in words, and says nothing when nothing waits", () => {
    assert.equal(waitingLabel(0), null);
    assert.equal(waitingLabel(-1), null);
    assert.equal(waitingLabel(1), "1 change waiting to send");
    assert.equal(waitingLabel(4), "4 changes waiting to send");
});
