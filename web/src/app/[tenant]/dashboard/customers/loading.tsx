import { SkeletonTable } from "@/components/ui/skeleton";

/** The card is the whole page here — no heading above it. Mirrors the customers list: heading, then the card and its columns. */
export default function Loading() {
    return (
        <div className="space-y-4">
            <SkeletonTable columns={["w-40", "w-28", "w-28", "w-12"]} rows={9} />
        </div>
    );
}
