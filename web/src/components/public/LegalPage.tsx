import { AlertTriangle } from "lucide-react";
import { PublicShell } from "@/components/public/PublicShell";
import { LEGAL_ENTITY, type Clause } from "@/lib/legal/documents";

/**
 * A legal document, rendered plainly.
 *
 * Set at a reading measure rather than in a dense column, because the whole
 * point of writing these in ordinary sentences is that somebody might actually
 * read them. A privacy policy nobody can get through is the same as not having
 * one, except that it looks like you tried.
 *
 * The draft banner is not decoration. Neither of these has been near a lawyer,
 * the entity behind them is not registered yet, and a page that quietly
 * presented them as settled would be the one dishonest thing on this site.
 */
export function LegalPage({
    title,
    intro,
    updated,
    clauses,
}: {
    title: string;
    intro: string;
    updated: string;
    clauses: Clause[];
}) {
    return (
        <PublicShell>
            <div className="mx-auto max-w-[68ch] px-4 py-14">
                <h1 className="text-[32px] font-semibold leading-tight tracking-tight text-slate-900">{title}</h1>
                <p className="mt-3 text-[15px] leading-relaxed text-slate-600">{intro}</p>
                <p className="mt-2 text-[13px] text-slate-500">Last updated {updated}.</p>

                <div className="mt-6 flex gap-3 border-y border-amber-300 bg-amber-50 px-4 py-3">
                    <AlertTriangle aria-hidden strokeWidth={1.75} className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    <p className="text-[13px] leading-relaxed text-slate-800">
                        <span className="font-semibold">This is a draft.</span> It has not been reviewed by a lawyer, and
                        {LEGAL_ENTITY.registered
                            ? " "
                            : " the business behind MOTION is not yet a registered entity, so the name below is a placeholder. "}
                        Do not rely on it as it stands. Points still to be decided are marked in the text.
                    </p>
                </div>

                <div className="mt-10 space-y-9">
                    {clauses.map((clause) => (
                        <section key={clause.heading}>
                            <h2 className="text-[18px] font-semibold tracking-tight text-slate-900">{clause.heading}</h2>
                            {clause.paragraphs.map((p, i) => (
                                <p key={i} className="mt-3 text-[15px] leading-[1.7] text-slate-700">{p}</p>
                            ))}
                            {clause.decide && (
                                <p className="mt-3 border-l border-amber-400 bg-amber-50/60 py-2 pl-3 text-[13px] leading-relaxed text-slate-700">
                                    <span className="font-semibold">To decide:</span> {clause.decide}
                                </p>
                            )}
                        </section>
                    ))}
                </div>

                <p className="mt-12 border-t border-slate-200 pt-5 text-[13px] leading-relaxed text-slate-500">
                    {LEGAL_ENTITY.registered
                        ? `${LEGAL_ENTITY.name}, ${LEGAL_ENTITY.jurisdiction}.`
                        : `Trading as ${LEGAL_ENTITY.name} in ${LEGAL_ENTITY.jurisdiction}. A registered entity and its address go here once one exists — until then no clause naming a company should be relied on.`}
                </p>
            </div>
        </PublicShell>
    );
}
