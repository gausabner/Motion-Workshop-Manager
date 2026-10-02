import { Clock } from "lucide-react";
import type { BankDetails } from "@/lib/billing/config";

/**
 * The holding page: where to pay, and what happens next.
 *
 * This is the only screen a `PENDING_PAYMENT` workshop can reach, and somebody
 * will come back to it — from a different device, days later, having lost the
 * email. So it carries everything needed to pay rather than pointing at the
 * email that also carries it.
 *
 * It is not a 404, which is what the old `isActive` check would have given a
 * paying customer. That is the whole reason `TenantStatus` exists.
 *
 * The reference is the load-bearing element on the page and is styled to be
 * read aloud and typed: large, monospaced, selectable, and repeated in prose
 * underneath. It is the only thing joining a line on a bank statement to this
 * workshop, and the field people most often leave blank.
 */
export function PaymentDetails({
    workshopName,
    planName,
    exclusive,
    inclusive,
    vatRate,
    reference,
    bank,
    supportEmail,
}: {
    workshopName: string;
    planName: string;
    exclusive: string;
    inclusive: string;
    vatRate: number;
    reference: string;
    bank: BankDetails;
    supportEmail: string | null;
}) {
    return (
        <div>
            <span className="grid h-11 w-11 place-items-center rounded-full bg-teal-50 text-teal-700">
                <Clock className="h-5 w-5" aria-hidden />
            </span>
            <h1 className="mt-4 text-[22px] font-semibold tracking-tight text-slate-900">One payment and you are in</h1>
            <p className="mt-2 text-[14px] leading-relaxed text-slate-600">
                <span className="font-medium text-slate-900">{workshopName}</span> is registered on the {planName} plan. Pay the
                amount below and we will switch it on — usually the same working day.
            </p>

            <dl className="mt-6 overflow-hidden rounded-xl border border-slate-200">
                <div className="flex items-baseline justify-between gap-4 border-b border-slate-200 bg-slate-50 px-4 py-3">
                    <dt className="text-[13px] text-slate-600">Amount due</dt>
                    <dd className="text-right">
                        <span className="text-[20px] font-semibold tabular-nums tracking-tight text-slate-900">{inclusive}</span>
                        <span className="ml-2 text-[12px] text-slate-500">
                            {exclusive} + {vatRate}% VAT
                        </span>
                    </dd>
                </div>

                <Row label="Bank" value={bank.bankName} />
                <Row label="Account name" value={bank.accountName} />
                <Row label="Account number" value={bank.accountNumber} mono />
                <Row label="Branch code" value={bank.branchCode} mono />
                {bank.accountType && <Row label="Account type" value={bank.accountType} />}
            </dl>

            <div className="mt-4 rounded-xl border-2 border-teal-600 px-4 py-3">
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-teal-800">Payment reference</p>
                <p className="mt-1 select-all font-mono text-[22px] font-semibold tracking-tight text-slate-900">{reference}</p>
                <p className="mt-2 text-[13px] leading-relaxed text-slate-700">
                    Use this as the reference on the deposit or transfer. Without it we cannot tell which workshop paid, and your
                    account will not be switched on.
                </p>
            </div>

            <p className="mt-5 text-[13px] leading-relaxed text-slate-600">
                Send the proof of payment to{" "}
                {supportEmail ? (
                    <a href={`mailto:${supportEmail}`} className="font-medium text-teal-700 hover:underline">
                        {supportEmail}
                    </a>
                ) : (
                    "us"
                )}{" "}
                and we will confirm it. You can close this page — signing in again brings you straight back here until the workshop
                is active.
            </p>
        </div>
    );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
    return (
        <div className="flex items-baseline justify-between gap-4 border-b border-slate-200 px-4 py-2.5 last:border-b-0">
            <dt className="text-[13px] text-slate-600">{label}</dt>
            {/* `select-all` on the two fields somebody retypes into banking,
                because a mistyped account number is a payment to a stranger. */}
            <dd className={`text-right text-[13.5px] text-slate-900 ${mono ? "select-all font-mono tabular-nums" : ""}`}>{value}</dd>
        </div>
    );
}
