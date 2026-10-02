import { randomInt } from "node:crypto";

/**
 * The reference a customer types into their online banking.
 *
 * This string is the only thing joining a line on a bank statement to a row in
 * the database. Matching is done by a person reading both, so every decision
 * here is about a human in a hurry rather than about entropy.
 *
 * **Short.** Banks truncate a reference field without saying so, and some are
 * as tight as twenty characters once their own prefixes are added. Ten is well
 * inside anything we will meet.
 *
 * **Unambiguous when read off a screen and typed somewhere else.** `0`/`O`,
 * `1`/`I`, `5`/`S` and `8`/`B` are dropped, so there is no pair a customer can
 * confuse and no pair our own staff can mis-read back. A reference nobody can
 * transcribe is a payment nobody can match, and an unmatched payment is an
 * account nobody activates — the customer has paid and is still locked out,
 * which is the worst outcome this flow has.
 *
 * **Prefixed.** `MOT-` makes it recognisable at a glance on a statement full
 * of other people's references, and it follows the habit this business already
 * has: its quotations carry a payment reference of their own.
 *
 * **Platform-unique, not per-workshop.** `Sequence` cannot issue these — it is
 * tenant-scoped, so two workshops would both be handed `0001` and two deposits
 * would be indistinguishable.
 */

/** 28 characters. No `0O`, `1I`, `5S` or `8B`. */
const ALPHABET = "ACDEFGHJKLMNPQRTUVWXYZ234679";

const LENGTH = 6;

export const REFERENCE_PREFIX = "MOT-";

/**
 * Random rather than sequential, deliberately.
 *
 * A sequence would leak how many customers MOTION has to anybody who registers
 * — `MOT-000007` says more about the business than it should — and would invite
 * guessing at somebody else's reference. 28^6 is 481 million, so a collision is
 * remote; the unique index is what makes it impossible rather than unlikely,
 * and the caller retries.
 *
 * `randomInt` rather than `randomBytes` modulo 28: 256 is not a multiple of 28,
 * so the modulo would quietly favour the first four letters of the alphabet.
 */
export function newReference(): string {
    let out = "";
    for (let i = 0; i < LENGTH; i++) out += ALPHABET[randomInt(0, ALPHABET.length)];
    return REFERENCE_PREFIX + out;
}

/**
 * Whether a string could be one of ours.
 *
 * Used when a human types a reference into the admin panel to find a payment.
 * It is case-insensitive and ignores spaces and dashes, because a customer who
 * writes `mot 7kq x4f` on a deposit slip has given us everything we need and it
 * would be perverse to refuse it.
 */
export function normaliseReference(input: string): string | null {
    const bare = input.toUpperCase().replace(/[\s-]/g, "");
    if (!bare.startsWith("MOT")) return null;
    const body = bare.slice(3);
    if (body.length !== LENGTH) return null;
    for (const c of body) if (!ALPHABET.includes(c)) return null;
    return REFERENCE_PREFIX + body;
}
