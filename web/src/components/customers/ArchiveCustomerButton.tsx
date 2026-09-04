import { Archive, ArchiveRestore } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setCustomerArchived } from "@/lib/customers/actions";

export function ArchiveCustomerButton({ tenant, id, archived }: { tenant: string; id: string; archived: boolean }) {
    const action = setCustomerArchived.bind(null, tenant, id, !archived);
    return (
        <form action={action}>
            <Button type="submit" variant="outline" size="sm" className={archived ? "text-teal-700" : "text-slate-600"}>
                {archived ? <><ArchiveRestore className="w-4 h-4 mr-1" />Unarchive</> : <><Archive className="w-4 h-4 mr-1" />Archive</>}
            </Button>
        </form>
    );
}
