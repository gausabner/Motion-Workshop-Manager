import type { MessageChannel } from "@prisma/client";
import type { MessageDriver, OutboundMessage, SendResult } from "@/lib/messaging/types";

/**
 * WhatsApp by deep link. Needs no account, no approval and no credentials —
 * it opens the sender's own WhatsApp with the message typed out, which is how
 * small Namibian workshops already send invoices, minus the retyping.
 */
export class WhatsAppLinkDriver implements MessageDriver {
    readonly name = "whatsapp-link";
    readonly channel = "WHATSAPP" as const;

    async send(message: OutboundMessage): Promise<SendResult> {
        if (!/^\d{8,15}$/.test(message.recipient)) return { kind: "failed", error: "That is not a number WhatsApp can reach." };
        return { kind: "handoff", url: `https://wa.me/${message.recipient}?text=${encodeURIComponent(message.body)}` };
    }
}

/** Email by the sender's own mail app. The fallback that needs nothing configured. */
export class MailtoDriver implements MessageDriver {
    readonly name = "mailto";
    readonly channel = "EMAIL" as const;

    async send(message: OutboundMessage): Promise<SendResult> {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(message.recipient)) return { kind: "failed", error: "That does not look like an email address." };
        const query = new URLSearchParams();
        if (message.subject) query.set("subject", message.subject);
        query.set("body", message.body);
        // URLSearchParams encodes spaces as "+", which mail clients print literally.
        return { kind: "handoff", url: `mailto:${encodeURIComponent(message.recipient)}?${query.toString().replace(/\+/g, "%20")}` };
    }
}

/**
 * Which driver carries each channel. `MESSAGING_WHATSAPP_DRIVER` and
 * `MESSAGING_EMAIL_DRIVER` pick; a provider (the WhatsApp Cloud API, SMTP, a
 * transactional mail service) slots in here without anything that sends a
 * message changing.
 */
export function driverFor(channel: MessageChannel): MessageDriver {
    switch (channel) {
        case "WHATSAPP": {
            const name = process.env.MESSAGING_WHATSAPP_DRIVER?.trim() || "whatsapp-link";
            if (name === "whatsapp-link") return new WhatsAppLinkDriver();
            throw new Error(`Unknown MESSAGING_WHATSAPP_DRIVER ${JSON.stringify(name)}`);
        }
        case "EMAIL": {
            const name = process.env.MESSAGING_EMAIL_DRIVER?.trim() || "mailto";
            if (name === "mailto") return new MailtoDriver();
            throw new Error(`Unknown MESSAGING_EMAIL_DRIVER ${JSON.stringify(name)}`);
        }
        case "SMS":
            throw new Error("No SMS driver is configured yet.");
    }
}
