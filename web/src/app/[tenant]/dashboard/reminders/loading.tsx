import { SkeletonHeading, SkeletonTable } from "@/components/ui/skeleton";

/** Mirrors the reminders list: heading, then the card and its columns. */
export default function Loading() {
    return (
        <div className="space-y-4">
            <SkeletonHeading />
            <SkeletonTable columns={["w-28", "w-24", "w-36", "w-32", "w-24"]} rows={9} />
        </div>
    );
}
