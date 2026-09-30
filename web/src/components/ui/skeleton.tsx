/**
 * Placeholders shaped like the thing that is coming.
 *
 * The rule the whole set follows: a skeleton has to be the same shape and in
 * the same place as the content it stands in for. A generic grey rectangle is
 * worse than nothing — the page moves when the real content lands, which is
 * the jarring change the skeleton was supposed to prevent.
 *
 * So these are built out of the app's own furniture: the same card borders,
 * the same table header height, the same column widths, the same row rhythm.
 * Anything that is chrome rather than data — a heading that is always the same
 * words, a border, a label — is drawn for real rather than skeletonised, since
 * it is already known and drawing a grey box over a known word is theatre.
 */

export function Skeleton({ className = "" }: { className?: string }) {
    return <span aria-hidden className={`skeleton block rounded-[2px] ${className}`} />;
}

/** A page's title block: a heading and the sentence under it. */
export function SkeletonHeading({ wide = false }: { wide?: boolean }) {
    return (
        <div className="space-y-2">
            <Skeleton className={`h-7 ${wide ? "w-72" : "w-48"}`} />
            <Skeleton className="h-4 w-[26rem] max-w-full" />
        </div>
    );
}

/**
 * The list shape almost every screen in MOTION uses: a card, a header strip,
 * and rows. Column widths are passed so a skeleton for the customers table is
 * not the same shape as one for invoices — which is the whole point.
 */
export function SkeletonTable({
    columns,
    rows = 8,
    title = true,
}: {
    /** Tailwind width classes, one per column, in the real table's proportions. */
    columns: string[];
    rows?: number;
    title?: boolean;
}) {
    return (
        <div className="rounded-sm border border-slate-200 bg-white">
            {title && (
                <div className="flex h-14 items-center justify-between border-b border-slate-200 px-4">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-8 w-8 rounded-sm" />
                </div>
            )}
            {/* Above 768px: the real header row is 10px uppercase on
                slate-50, and matching its height keeps the rows below from
                shifting when data lands. */}
            <div className="hidden items-center gap-4 border-b border-slate-200 bg-slate-50 px-4 py-2 md:flex">
                {columns.map((w, i) => (
                    <Skeleton key={i} className={`h-2.5 ${w}`} />
                ))}
            </div>
            <div className="hidden divide-y divide-slate-100 md:block">
                {Array.from({ length: rows }).map((_, r) => (
                    <div key={r} className="flex items-center gap-4 px-4 py-3">
                        {columns.map((w, i) => (
                            <Skeleton key={i} className={`h-3.5 ${w}`} />
                        ))}
                    </div>
                ))}
            </div>

            {/* Below 768px a MOTION table is not a table: `data-mobile="cards"`
                turns it into one card per record, the identifying field
                leading and the rest labelled beneath. A column skeleton here
                would be replaced by a completely different shape the moment
                the data landed — which is the jolt this is meant to prevent,
                delivered on the device it matters most on. */}
            <div className="divide-y divide-slate-100 md:hidden">
                {Array.from({ length: Math.min(rows, 6) }).map((_, r) => (
                    <div key={r} className="space-y-2 px-4 py-3">
                        <Skeleton className="h-4 w-1/2" />
                        {columns.slice(1, 4).map((_, i) => (
                            <div key={i} className="flex items-center justify-between gap-4">
                                <Skeleton className="h-3 w-20" />
                                <Skeleton className="h-3 w-24" />
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}

/** The figure tiles that head a report. */
export function SkeletonStats({ count = 4 }: { count?: number }) {
    return (
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}>
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="rounded-sm border border-slate-200 bg-white px-4 py-3">
                    <Skeleton className="h-2.5 w-20" />
                    <Skeleton className="mt-2 h-7 w-28" />
                </div>
            ))}
        </div>
    );
}

/** A form: labelled fields in a bordered panel. */
export function SkeletonForm({ fields = 6 }: { fields?: number }) {
    return (
        <div className="max-w-3xl space-y-4">
            <div className="rounded-sm border border-slate-200 bg-white">
                <div className="border-b border-slate-200 bg-slate-50 px-4 py-2">
                    <Skeleton className="h-2.5 w-28" />
                </div>
                <div className="grid gap-4 p-4 sm:grid-cols-2">
                    {Array.from({ length: fields }).map((_, i) => (
                        <div key={i} className="space-y-1.5">
                            <Skeleton className="h-3 w-24" />
                            <Skeleton className="h-9 w-full rounded-md" />
                        </div>
                    ))}
                </div>
            </div>
            <Skeleton className="h-9 w-24 rounded-md" />
        </div>
    );
}

/** A record page: the document or customer panel with its side column. */
export function SkeletonDetail() {
    return (
        <div className="space-y-4">
            <SkeletonHeading wide />
            <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
                <div className="space-y-4">
                    <div className="rounded-sm border border-slate-200 bg-white p-4">
                        <Skeleton className="h-4 w-40" />
                        <div className="mt-4 space-y-2.5">
                            {Array.from({ length: 5 }).map((_, i) => (
                                <Skeleton key={i} className="h-3.5 w-full" />
                            ))}
                        </div>
                    </div>
                    <SkeletonTable columns={["w-1/3", "w-16", "w-20", "w-24"]} rows={4} title={false} />
                </div>
                <div className="space-y-4">
                    {Array.from({ length: 2 }).map((_, i) => (
                        <div key={i} className="rounded-sm border border-slate-200 bg-white p-4">
                            <Skeleton className="h-2.5 w-24" />
                            <div className="mt-3 space-y-2">
                                <Skeleton className="h-3.5 w-full" />
                                <Skeleton className="h-3.5 w-2/3" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

/** The standard list screen, heading and all. */
export function SkeletonListPage({ columns, rows }: { columns: string[]; rows?: number }) {
    return (
        <div className="space-y-4">
            <SkeletonTable columns={columns} rows={rows} />
        </div>
    );
}
