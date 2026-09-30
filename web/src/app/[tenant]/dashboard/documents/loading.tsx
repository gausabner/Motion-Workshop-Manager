import { SkeletonTable } from "@/components/ui/skeleton";

/** The card is the whole page here — no heading above it. Mirrors the documents list: heading, then the card and its columns. */
export default function Loading() {
    return (
        <div className="space-y-4">
            <SkeletonTable columns={["w-24", "w-24", "w-40", "w-24", "w-20", "w-20"]} rows={9} />
        </div>
    );
}
