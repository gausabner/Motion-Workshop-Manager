import Link from "next/link";
import { Lock } from "lucide-react";
import type { UserGroup } from "@prisma/client";
import { GROUP_LABELS } from "@/lib/auth/permissions";
import { Button } from "@/components/ui/button";

/**
 * What someone sees when they open a screen their role does not cover.
 *
 * It used to be `notFound()` — the bare "This page could not be found", which
 * is both undesigned and untrue. The page exists; they are simply not allowed
 * to open it. Telling somebody a screen is missing when it is not sends them
 * looking for a bug, or to the owner saying the software is broken.
 *
 * So it says what happened, what they are, what they would need, and who can
 * grant it. Naming the role matters: on a shared counter machine the commonest
 * cause of this screen is that the last person never signed out, and "you are
 * signed in as Mechanic" is what makes that obvious.
 *
 * It deliberately does not offer a way to request access. A message a workshop
 * owner has to find and action is worse than walking over and asking, in a
 * business where everyone is within shouting distance.
 */
export function AccessDenied({
    tenant,
    group,
    needs,
    area,
}: {
    tenant: string;
    group: UserGroup;
    /** Plain words for what the screen needs, e.g. "manage settings". */
    needs: string;
    /** What they were trying to open, e.g. "Company settings". */
    area?: string;
}) {
    return (
        <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-12 text-center sm:py-20">
            <span className="mb-5 grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-slate-500">
                <Lock className="h-5 w-5" aria-hidden="true" />
            </span>

            <h1 className="text-xl font-bold text-slate-800">
                {area ? `${area} needs permission` : "This needs permission"}
            </h1>

            <p className="mt-2 text-sm text-slate-600">
                You are signed in as <strong className="font-semibold text-slate-800">{GROUP_LABELS[group]}</strong>,
                which cannot {needs}. Nothing is wrong — this part of MOTION is simply not part of your role.
            </p>

            <p className="mt-2 text-sm text-slate-500">
                The workshop owner can change this under Team. If you are at a shared computer, check whether
                somebody else is still signed in.
            </p>

            <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
                <Button asChild className="h-11 bg-teal-600 px-5 hover:bg-teal-700">
                    <Link href={`/${tenant}/dashboard`}>Back to the dashboard</Link>
                </Button>
            </div>
        </div>
    );
}
