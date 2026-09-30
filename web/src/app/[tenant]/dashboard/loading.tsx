import { Skeleton, SkeletonStats } from "@/components/ui/skeleton";

/** The dashboard: the figure tiles, the setup checklist, and the two panels. */
export default function Loading() {
    return (
        <div className="space-y-4">
            <Skeleton className="h-7 w-56" />
            <SkeletonStats count={4} />
            <div className="grid gap-4 lg:grid-cols-2">
                {Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className="rounded-sm border border-slate-200 bg-white">
                        <div className="border-b border-slate-200 px-4 py-2.5">
                            <Skeleton className="h-3.5 w-36" />
                        </div>
                        <div className="divide-y divide-slate-100">
                            {Array.from({ length: 5 }).map((_, r) => (
                                <div key={r} className="flex items-center justify-between gap-4 px-4 py-2.5">
                                    <Skeleton className="h-3.5 w-44" />
                                    <Skeleton className="h-3.5 w-16" />
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
