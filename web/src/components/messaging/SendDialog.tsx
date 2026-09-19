"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { MessageChannel } from "@prisma/client";
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, Mail, MessageCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { draftMessageAction, sendMessageAction } from "@/lib/messaging/actions";
import type { Draft, SendTarget } from "@/lib/messaging/service";

type Props = {
    tenant: string;
    target: SendTarget;
    /** What the button says the thing is, e.g. "invoice INV-1004". */
    label: string;
    size?: "sm" | "default";
    variant?: "default" | "outline";
};

/** What the link in the message opens, said plainly — it differs by what is being sent. */
function linkNote(target: SendTarget): { intro: string; field: string } {
    if (target.kind === "REMINDER") {
        return target.reminder === "BOOKING" || target.reminder === "QUOTE_FOLLOW_UP"
            ? { intro: "The customer gets a link that opens the " + (target.reminder === "BOOKING" ? "booking" : "quote") + " — no account needed.", field: "becomes the link when you send. Remove it and the link goes on the end." }
            : { intro: "A reminder about a date. When online booking is on, it carries the link to your booking page.", field: "becomes your online booking link when you send; with online booking off, that line is left out." };
    }
    if (target.kind === "PORTAL") return { intro: "The customer gets their own portal link — invoices, vehicles and approvals in one place, no account needed.", field: "becomes their portal link when you send. Remove it and the link goes on the end." };
    if (target.kind === "INSPECTION") return { intro: "The customer gets a link to the findings, where they approve or decline each one — no account needed.", field: "becomes the link to the inspection when you send. Remove it and the link goes on the end." };
    return { intro: "The customer gets a link that opens the PDF — no account needed.", field: "becomes the link to the document when you send. Remove it and the link goes on the end." };
}

type Phase = { step: "compose" } | { step: "done"; url: string | null; channel: MessageChannel; blocked: boolean };

/**
 * Send a document to the customer, on WhatsApp or by email.
 *
 * The message is shown in full and editable before anything happens, because
 * it goes out under the workshop's name. The link to the document is minted
 * only when Send is pressed, so abandoning this dialog leaves nothing live.
 */
export function SendDialog({ tenant, target, label, size = "sm", variant = "outline" }: Props) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [channel, setChannel] = useState<MessageChannel>("WHATSAPP");
    const [draft, setDraft] = useState<Draft | null>(null);
    const [recipient, setRecipient] = useState("");
    const [subject, setSubject] = useState("");
    const [body, setBody] = useState("");
    const [error, setError] = useState<string>();
    const [phase, setPhase] = useState<Phase>({ step: "compose" });
    const [loading, startLoading] = useTransition();
    const [sending, startSending] = useTransition();

    function load(next: MessageChannel) {
        setChannel(next);
        setError(undefined);
        startLoading(async () => {
            const result = await draftMessageAction(tenant, target, next);
            if (!result) {
                setError("There is nothing to send here any more, or nobody to send it to.");
                return;
            }
            setDraft(result);
            setRecipient(result.recipient);
            setSubject(result.subject ?? "");
            setBody(result.body);
        });
    }

    function openDialog(value: boolean) {
        setOpen(value);
        if (value) {
            setPhase({ step: "compose" });
            load(channel);
        }
    }

    function send() {
        setError(undefined);
        // Opened now, while the click still counts as a user gesture; pointed at
        // WhatsApp once the link exists. Opened after an await it would be blocked.
        const popup = window.open("about:blank", "_blank");
        startSending(async () => {
            const outcome = await sendMessageAction(tenant, { target, channel, recipient, subject, body });
            if (!outcome.ok) {
                popup?.close();
                setError(outcome.message);
                return;
            }
            if (outcome.url && popup) {
                popup.opener = null;
                popup.location.replace(outcome.url);
            } else {
                popup?.close();
            }
            setPhase({ step: "done", url: outcome.url, channel, blocked: !!outcome.url && !popup });
            router.refresh();
        });
    }

    const app = channel === "WHATSAPP" ? "WhatsApp" : "your mail app";

    return (
        <>
            <Button type="button" size={size} variant={variant} onClick={() => openDialog(true)}>
                <Send className="w-4 h-4 mr-1" />Send
            </Button>
            <Dialog open={open} onOpenChange={openDialog}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Send {label}</DialogTitle>
                        <DialogDescription>
                            {draft ? `To ${draft.customerName}. ` : ""}{linkNote(target).intro}
                        </DialogDescription>
                    </DialogHeader>

                    {phase.step === "done" ? (
                        <div className="space-y-3 py-2">
                            <p className="flex items-start gap-2 text-sm text-slate-700">
                                <CheckCircle2 className="w-5 h-5 text-teal-600 shrink-0" />
                                <span>
                                    The message is ready in {phase.channel === "WHATSAPP" ? "WhatsApp" : "your mail app"}. Press send there.
                                    You will see on this page when the customer opens it.
                                </span>
                            </p>
                            {phase.url && (
                                <a
                                    href={phase.url} target="_blank" rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-sm font-medium text-teal-700 hover:underline"
                                >
                                    <ExternalLink className="w-4 h-4" />{phase.blocked ? `Your browser blocked the window — open ${phase.channel === "WHATSAPP" ? "WhatsApp" : "the email"}` : "Open it again"}
                                </a>
                            )}
                            <div className="flex justify-end">
                                <Button type="button" size="sm" onClick={() => setOpen(false)}>Done</Button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="flex gap-2" role="radiogroup" aria-label="Channel">
                                {(["WHATSAPP", "EMAIL"] as const).map((c) => (
                                    <button
                                        key={c} type="button" role="radio" aria-checked={channel === c} onClick={() => load(c)}
                                        className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm ${channel === c ? "border-teal-600 bg-teal-50 text-teal-800 font-medium" : "border-slate-300 text-slate-600 hover:bg-slate-50"}`}
                                    >
                                        {c === "WHATSAPP" ? <MessageCircle className="w-4 h-4" /> : <Mail className="w-4 h-4" />}
                                        {c === "WHATSAPP" ? "WhatsApp" : "Email"}
                                    </button>
                                ))}
                            </div>

                            {loading ? (
                                <p className="flex items-center gap-2 py-6 text-sm text-slate-400"><Loader2 className="w-4 h-4 animate-spin" />Preparing the message…</p>
                            ) : draft ? (
                                <>
                                    {draft.warnings.map((w) => (
                                        <p key={w} className="flex items-start gap-2 rounded-sm border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                                            <AlertTriangle className="w-4 h-4 shrink-0" />{w}
                                        </p>
                                    ))}
                                    <label className="block space-y-1">
                                        <span className="text-xs text-slate-600">{channel === "WHATSAPP" ? "WhatsApp number" : "Email address"}</span>
                                        <input
                                            value={recipient} onChange={(e) => setRecipient(e.target.value)}
                                            type={channel === "WHATSAPP" ? "tel" : "email"}
                                            placeholder={channel === "WHATSAPP" ? "+264 81 234 5678" : "name@example.com"}
                                            className="h-9 w-full rounded-md border border-input bg-white px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-teal-500"
                                        />
                                        {channel === "WHATSAPP" && <span className="block text-[11px] text-slate-400">Local numbers are fine — 081… becomes +264 81….</span>}
                                    </label>
                                    {channel === "EMAIL" && (
                                        <label className="block space-y-1">
                                            <span className="text-xs text-slate-600">Subject</span>
                                            <input
                                                value={subject} onChange={(e) => setSubject(e.target.value)}
                                                className="h-9 w-full rounded-md border border-input bg-white px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-teal-500"
                                            />
                                        </label>
                                    )}
                                    <label className="block space-y-1">
                                        <span className="text-xs text-slate-600">Message</span>
                                        <textarea
                                            value={body} onChange={(e) => setBody(e.target.value)} rows={7}
                                            className="w-full rounded-md border border-input bg-white px-2 py-1.5 text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-teal-500"
                                        />
                                        <span className="block text-[11px] text-slate-400">
                                            <code className="text-slate-500">{"{{link}}"}</code> {linkNote(target).field}
                                        </span>
                                    </label>
                                </>
                            ) : null}

                            {error && <p className="text-sm text-red-600" role="alert">{error}</p>}

                            <div className="flex items-center justify-end gap-2 pt-1">
                                <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                                <Button type="button" size="sm" className="bg-teal-600 hover:bg-teal-700" disabled={!draft || sending || loading || !recipient.trim()} onClick={send}>
                                    {sending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Send className="w-4 h-4 mr-1" />}
                                    Open in {app}
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
