import { Skeleton } from "@/components/ui/skeleton";

/**
 * The diary: a day strip, then lanes of hours. Laid out as the real grid
 * rather than as rows, because the diary is the one screen whose shape is
 * nothing like a table and a table skeleton here would land as a jolt.
 */
export default function Loading() {
    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <Skeleton className="h-7 w-40" />
                <div className="flex gap-2">
                    <Skeleton className="h-9 w-24 rounded-md" />
                    <Skeleton className="h-9 w-9 rounded-md" />
                </div>
            </div>
            <div className="rounded-sm border border-slate-200 bg-white">
                <div className="grid grid-cols-[4rem_repeat(4,minmax(0,1fr))] border-b border-slate-200 bg-slate-50">
                    <div />
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="border-l border-slate-200 px-3 py-2">
                            <Skeleton className="h-2.5 w-20" />
                        </div>
                    ))}
                </div>
                {Array.from({ length: 8 }).map((_, h) => (
                    <div key={h} className="grid grid-cols-[4rem_repeat(4,minmax(0,1fr))] border-b border-slate-100">
                        <div className="px-3 py-3">
                            <Skeleton className="h-2.5 w-10" />
                        </div>
                        {Array.from({ length: 4 }).map((_, lane) => (
                            <div key={lane} className="border-l border-slate-100 p-1.5">
                                {/* Not every slot is booked; a full grid of blocks
                                    would promise a busier day than usually lands. */}
                                {(h + lane) % 3 === 0 && <Skeleton className="h-10 w-full rounded-sm" />}
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}
