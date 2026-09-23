import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * A genuine 404 inside a workshop: a job number that does not exist, a
 * bookmark to something since voided, a mistyped address.
 *
 * Permission denials no longer land here — they have their own screen that
 * says so plainly. What is left is the honest case, and the useful thing to
 * offer is the way back rather than an apology.
 */
export default function NotFound() {
    return (
        <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-12 text-center sm:py-20">
            <span className="mb-5 grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-slate-500">
                <SearchX className="h-5 w-5" aria-hidden="true" />
            </span>
            <h1 className="text-xl font-bold text-slate-800">That is not here</h1>
            <p className="mt-2 text-sm text-slate-600">
                The page or record you asked for does not exist. It may have been voided, or the address may be
                wrong — job numbers and document numbers are easy to mistype.
            </p>
            <div className="mt-7">
                <Button asChild className="h-11 bg-teal-600 px-5 hover:bg-teal-700">
                    <Link href="../">Go back</Link>
                </Button>
            </div>
        </div>
    );
}
