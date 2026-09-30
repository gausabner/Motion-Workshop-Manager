import { SkeletonTable } from "@/components/ui/skeleton";

/** The card is the whole page here — no heading above it. Mirrors the products list: heading, then the card and its columns. */
export default function Loading() {
    return (
        <div className="space-y-4">
            <SkeletonTable columns={["w-28", "w-48", "w-20", "w-16", "w-20"]} rows={9} />
        </div>
    );
}
