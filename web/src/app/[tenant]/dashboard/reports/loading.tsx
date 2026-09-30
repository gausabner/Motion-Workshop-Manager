import { Skeleton } from "@/components/ui/skeleton";

/** The reports index: a grid of cards, each a title, a sentence and a figure. */
export default function Loading() {
    return (
        <div className="mx-auto w-full max-w-4xl space-y-4">
            <div className="space-y-2">
                <Skeleton className="h-7 w-32" />
                <Skeleton className="h-4 w-[30rem] max-w-full" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex gap-3 rounded-sm border border-slate-200 bg-white px-4 py-3">
                        <Skeleton className="mt-0.5 h-5 w-5 shrink-0" />
                        <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-3 w-full" />
                            <Skeleton className="h-3 w-3/4" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
