import { Download, FileText } from "lucide-react";

/**
 * The two download buttons, wherever a screen can be taken away as a file.
 *
 * CSV first and PDF second, which is the opposite of the audit screen. The
 * order is the recommendation: an owner looking at a report on screen wants to
 * sort it, and the person who wants it on paper knows to look for the second
 * button. On the audit page the filed document is the point, so it leads.
 */
export function DownloadPair({ tenant, report, params = {}, from = "business" }: {
    tenant: string;
    report: string;
    params?: Record<string, string | undefined>;
    /** Which download route the report lives on — the owner's or the auditor's. */
    from?: "business" | "audit";
}) {
    const search = new URLSearchParams({ report, ...Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][]) });
    const href = (format: "csv" | "pdf") => `/${tenant}/dashboard/reports/${from}/download?${search.toString()}&format=${format}`;
    const style = "inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50";
    return (
        <span className="flex gap-2">
            <a href={href("csv")} className={style}><Download className="h-4 w-4" />CSV</a>
            <a href={href("pdf")} className={style}><FileText className="h-4 w-4" />PDF</a>
        </span>
    );
}

/**
 * One icon, for a screen with no room for two buttons.
 *
 * The customer and vehicle lists have a header that already clips on a phone,
 * and a listing is wanted as a spreadsheet rather than as a filed page, so
 * these get the CSV alone. The PDF is still there on the reports screen for
 * anyone who wants it.
 */
export function DownloadIcon({ tenant, report, params = {}, title }: { tenant: string; report: string; params?: Record<string, string | undefined>; title: string }) {
    const search = new URLSearchParams({ report, ...Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][]) });
    return (
        <a
            href={`/${tenant}/dashboard/reports/business/download?${search.toString()}&format=csv`}
            title={title}
            aria-label={title}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-slate-300 bg-slate-100 text-slate-600 shadow-sm hover:bg-slate-200"
        >
            <Download className="h-4 w-4" />
        </a>
    );
}
