import { SkeletonHeading, SkeletonTable } from "@/components/ui/skeleton";

/** Mirrors the purchasing list: heading, then the card and its columns. */
export default function Loading() {
    return (
        <div className="space-y-4">
            <SkeletonHeading />
            <SkeletonTable columns={["w-24", "w-40", "w-28", "w-24", "w-20"]} rows={9} />
        </div>
    );
}
