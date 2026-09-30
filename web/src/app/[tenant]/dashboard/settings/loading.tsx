import { Skeleton, SkeletonForm } from "@/components/ui/skeleton";

/** Any settings screen: a heading, a rule, and a form. */
export default function Loading() {
    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Skeleton className="h-5 w-44" />
                <Skeleton className="h-4 w-[32rem] max-w-full" />
            </div>
            <div className="border-t border-slate-200" />
            <SkeletonForm fields={6} />
        </div>
    );
}
