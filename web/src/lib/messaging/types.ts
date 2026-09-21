import type { MessageChannel } from "@prisma/client";

/**
 * The seam every way of reaching a customer plugs into (R3), the same shape as
 * the storage layer: call sites never learn which carrier took the message.
 *
 * Two kinds of result, and the difference matters for what we tell the user:
 *
 *  - `handoff` — we prepared the message and handed it to the sender's own
 *    WhatsApp or mail app. We cannot see whether they pressed send, so it is
 *    recorded as handed off, never as sent.
 *  - `sent` — a provider accepted it and gave us an id to track it by.
 */

export type OutboundMessage = {
    channel: MessageChannel;
    /** A phone number in international digits for WhatsApp and SMS, an address for email. */
    recipient: string;
    subject?: string;
    body: string;
};

export type SendResult =
    | { kind: "handoff"; url: string }
    | { kind: "sent"; externalId: string }
    | { kind: "failed"; error: string };

export interface MessageDriver {
    readonly name: string;
    readonly channel: MessageChannel;
    send(message: OutboundMessage): Promise<SendResult>;
}
