"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { archiveProduct } from "@/lib/products/actions";

export function ArchiveProductButton({ tenant, id, archived }: { tenant: string; id: string; archived: boolean }) {
    const [pending, start] = useTransition();
    return (
        <Button type="button" size="sm" variant="outline" className="h-8" disabled={pending} onClick={() => start(() => archiveProduct(tenant, id, !archived))}>
            {pending ? "…" : archived ? "Put back on the list" : "Archive"}
        </Button>
    );
}
