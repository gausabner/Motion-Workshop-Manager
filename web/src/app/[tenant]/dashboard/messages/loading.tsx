import { SkeletonHeading, SkeletonTable } from "@/components/ui/skeleton";

/** Mirrors the messages list: heading, then the card and its columns. */
export default function Loading() {
    return (
        <div className="space-y-4">
            <SkeletonHeading />
            <SkeletonTable columns={["w-32", "w-56", "w-24", "w-20"]} rows={9} />
        </div>
    );
}
