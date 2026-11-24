import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

const cell = "flex h-full items-center px-3";

/**
 * Page through a list. A step that cannot be taken is text, not a link that
 * does nothing, so it leaves the tab order; the current page says it is.
 * `ends` adds First and Last for lists long enough to need them.
 */
export function Pager({ page, pages, href, ends = false }: { page: number; pages: number; href: (page: number) => string; ends?: boolean }) {
    const step = (to: number, off: boolean, label: string, children: React.ReactNode, edge: string) =>
        off ? (
            <span aria-disabled="true" className={`${cell} ${edge} text-slate-300`}>
                {children}
                <span className="sr-only">{label}</span>
            </span>
        ) : (
            <Link href={href(to)} aria-label={label} className={`relative hit-area ${cell} ${edge} text-slate-600 transition-colors duration-150 hover:bg-slate-50`}>
                {children}
            </Link>
        );
    const first = page <= 1;
    const last = page >= pages;
    return (
        <nav aria-label="Pages" className="flex h-8 items-center rounded-sm border border-slate-200 bg-white text-xs">
            {ends && step(1, first, "First page", "First", "border-r border-slate-200")}
            {step(page - 1, first, "Previous page", <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />, "border-r border-slate-200")}
            <span aria-current="page" className={`${cell} border-r border-slate-200 bg-slate-50 px-4 font-semibold tabular-nums text-slate-900`}>
                <span className="sr-only">Page </span>
                {page} / {pages}
            </span>
            {step(page + 1, last, "Next page", <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />, ends ? "border-r border-slate-200" : "")}
            {ends && step(pages, last, "Last page", "Last", "")}
        </nav>
    );
}
