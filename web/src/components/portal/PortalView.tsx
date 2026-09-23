import type { CSSProperties, ReactNode } from "react";
import { CalendarDays, Car, ChevronRight, ClipboardCheck, FileText, MessageCircle, Phone, Wrench } from "lucide-react";
import { dateShort, money } from "@/lib/format";
import type { PortalView as Data } from "@/lib/portal/data";

/** A plain link, or a form action for a step that creates something (a fresh approval link). */
export type Target = string | (() => Promise<void>);

export type PortalLinks = {
    document: (id: string) => string;
    statement: string;
    inspection: (id: string) => Target;
    book: string | null;
    logo: string | null;
};

export type PortalWorkshop = { name: string; phone: string | null; whatsapp: string | null; currency: string; accent: string; welcome: string };

const TYPE_LABEL = { INVOICE: "Invoice", CASH_SALE: "Cash sale", CREDIT: "Credit note" } as const;

/** Days from today to a date, for "in 12 days" and a warning colour inside a month. */
function until(day: string | null, today: string): { text: string; soon: boolean } | null {
    if (!day) return null;
    const diff = Math.round((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
    const text = diff === 0 ? "today" : diff > 0 ? `in ${diff} day${diff === 1 ? "" : "s"}` : `${-diff} day${diff === -1 ? "" : "s"} ago`;
    return { text, soon: diff <= 30 };
}

function Go({ to, className, style, children, label }: { to: Target; className: string; style?: CSSProperties; children: ReactNode; label?: string }) {
    if (typeof to === "string") return <a href={to} className={className} style={style} aria-label={label}>{children}</a>;
    return (
        <form action={to}>
            <button type="submit" className={`${className} w-full text-left`} style={style} aria-label={label}>{children}</button>
        </form>
    );
}

function Section({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
    return (
        <section className="rounded-lg border border-slate-200 bg-white">
            <h2 className="flex items-center gap-2 border-b border-slate-100 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500">{icon}{title}</h2>
            {children}
        </section>
    );
}

/**
 * What a customer sees of their own account. Server-rendered and link-only:
 * nothing here writes, so the only moving parts are the links out to a PDF,
 * the statement, and the inspection approval page they already know.
 */
export function PortalView({ customerName, workshop, data, links, banner }: { customerName: string; workshop: PortalWorkshop; data: Data; links: PortalLinks; banner?: ReactNode }) {
    const phone = workshop.phone?.replace(/[^\d+]/g, "");
    const wa = workshop.whatsapp?.replace(/\D/g, "");
    const waiting = data.inspections.filter((i) => i.waiting > 0);
    const nothing = !data.account && data.inspections.length + data.jobs.length + data.bookings.length + data.vehicles.length + data.invoices.length + data.quotes.length === 0;

    return (
        <div className="min-h-svh bg-slate-100" style={{ ["--accent" as string]: workshop.accent }}>
            {banner}
            <header className="bg-white border-b border-slate-200">
                <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
                    {links.logo
                        // eslint-disable-next-line @next/next/no-img-element -- served per token; next/image cannot optimise it
                        ? <img src={links.logo} alt={workshop.name} className="h-10 w-auto max-w-[140px] object-contain" />
                        : <span className="grid h-10 w-10 place-items-center rounded-md text-lg font-bold text-white" style={{ background: "var(--accent)" }}>{workshop.name.slice(0, 1)}</span>}
                    <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-slate-800">{workshop.name}</p>
                        <p className="text-xs text-slate-500">Your account, {customerName}</p>
                    </div>
                    {wa && <a href={`https://wa.me/${wa}`} className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 text-slate-600" aria-label="WhatsApp the workshop"><MessageCircle className="h-5 w-5" /></a>}
                    {phone && <a href={`tel:${phone}`} className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 text-slate-600" aria-label="Call the workshop"><Phone className="h-5 w-5" /></a>}
                </div>
            </header>

            <main className="mx-auto max-w-2xl space-y-4 px-4 py-5">
                {workshop.welcome && <p className="whitespace-pre-line rounded-lg bg-white px-4 py-3 text-sm text-slate-700 border-l-4" style={{ borderColor: "var(--accent)" }}>{workshop.welcome}</p>}

                {waiting.map((i) => (
                    <Go key={i.id} to={links.inspection(i.id)} className="flex items-center gap-3 rounded-lg px-4 py-3 text-white shadow-sm" style={{ background: "var(--accent)" }}>
                        <ClipboardCheck className="h-6 w-6 shrink-0" />
                        <span className="flex-1">
                            <span className="block font-semibold">We need your go-ahead</span>
                            <span className="block text-sm opacity-90">{i.waiting} finding{i.waiting === 1 ? "" : "s"} on your {i.vehicle ?? "vehicle"} — see the photos and choose</span>
                        </span>
                        <ChevronRight className="h-5 w-5 shrink-0" />
                    </Go>
                ))}

                {data.account && (
                    <Section title="Your account" icon={<FileText className="h-4 w-4" />}>
                        <div className="flex flex-wrap items-end justify-between gap-3 px-4 py-3">
                            <div>
                                <p className={`text-2xl font-bold tabular-nums ${data.account.owing > 0 ? "text-slate-900" : "text-slate-500"}`}>
                                    {data.account.owing > 0 ? money(data.account.owing, workshop.currency) : data.account.owing < 0 ? `${money(-data.account.owing, workshop.currency)} in credit` : "Nothing owing"}
                                </p>
                                {data.account.owing > 0 && <p className="text-sm text-slate-500">{data.account.overdue > 0 ? `${money(data.account.overdue, workshop.currency)} of it is more than 30 days old` : "Owing on your account"}</p>}
                            </div>
                            <a href={links.statement} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700">Statement (PDF)</a>
                        </div>
                    </Section>
                )}

                {data.jobs.length > 0 && (
                    <Section title="In the workshop now" icon={<Wrench className="h-4 w-4" />}>
                        <ul className="divide-y divide-slate-100">
                            {data.jobs.map((j) => (
                                <li key={j.id} className="flex items-center justify-between gap-3 px-4 py-3">
                                    <span className="text-sm text-slate-700">{j.vehicle ?? "Your vehicle"}</span>
                                    <span className="shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold text-white" style={{ background: "var(--accent)" }}>{j.status}</span>
                                </li>
                            ))}
                        </ul>
                    </Section>
                )}

                {data.bookings.length > 0 && (
                    <Section title="Coming up" icon={<CalendarDays className="h-4 w-4" />}>
                        <ul className="divide-y divide-slate-100">
                            {data.bookings.map((b) => (
                                <li key={b.id} className="px-4 py-3">
                                    <p className="font-medium text-slate-800">{b.when}</p>
                                    <p className="text-sm text-slate-500">{[b.vehicle, b.description].filter(Boolean).join(" · ")}</p>
                                </li>
                            ))}
                        </ul>
                    </Section>
                )}

                {data.vehicles.length > 0 && (
                    <Section title="Your vehicles" icon={<Car className="h-4 w-4" />}>
                        <ul className="divide-y divide-slate-100">
                            {data.vehicles.map((v) => {
                                const dates = [
                                    { label: "Next service", day: v.nextServiceDate, extra: v.nextServiceKm ? `${v.nextServiceDate ? "or at" : "at"} ${v.nextServiceKm.toLocaleString("en-NA")} km` : null },
                                    { label: "Licence disc", day: v.licenceExpiry, extra: null },
                                    { label: "Roadworthy", day: v.roadworthyExpiry, extra: null },
                                ].filter((d) => d.day || d.extra);
                                return (
                                    <li key={v.id} className="px-4 py-3">
                                        <p className="font-medium text-slate-800">{v.name}</p>
                                        {dates.length > 0 ? (
                                            <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
                                                {dates.map((d) => {
                                                    const u = until(d.day, data.today);
                                                    return (
                                                        <div key={d.label} className="contents">
                                                            <dt className="text-slate-500">{d.label}</dt>
                                                            <dd className={u?.soon ? "font-medium text-amber-700" : "text-slate-700"}>
                                                                {[d.day && dateShort(d.day), d.extra].filter(Boolean).join(" ")}{u && <span className="text-slate-400"> ({u.text})</span>}
                                                            </dd>
                                                        </div>
                                                    );
                                                })}
                                            </dl>
                                        ) : <p className="text-sm text-slate-400">No dates on file yet.</p>}
                                    </li>
                                );
                            })}
                        </ul>
                        {links.book && (
                            <div className="border-t border-slate-100 px-4 py-3">
                                <a href={links.book} className="block rounded-md py-2.5 text-center font-semibold text-white" style={{ background: "var(--accent)" }}>Book a service</a>
                            </div>
                        )}
                    </Section>
                )}

                {data.quotes.length > 0 && (
                    <Section title="Quotes" icon={<FileText className="h-4 w-4" />}>
                        <ul className="divide-y divide-slate-100">
                            {data.quotes.map((q) => (
                                <li key={q.id}>
                                    <a href={links.document(q.id)} className="flex items-center gap-3 px-4 py-3">
                                        <span className="flex-1 min-w-0">
                                            <span className="block text-sm font-medium text-slate-800">Quote {q.number} · {dateShort(q.date)}</span>
                                            {q.vehicle && <span className="block truncate text-xs text-slate-500">{q.vehicle}</span>}
                                        </span>
                                        <span className="text-sm tabular-nums text-slate-700">{money(q.total, workshop.currency)}</span>
                                        <ChevronRight className="h-4 w-4 text-slate-300" />
                                    </a>
                                </li>
                            ))}
                        </ul>
                        <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">To go ahead, reply to the workshop on WhatsApp or give them a call.</p>
                    </Section>
                )}

                {data.invoices.length > 0 && (
                    <Section title="Invoices" icon={<FileText className="h-4 w-4" />}>
                        <ul className="divide-y divide-slate-100">
                            {data.invoices.map((d) => (
                                <li key={d.id}>
                                    <a href={links.document(d.id)} className="flex items-center gap-3 px-4 py-3">
                                        <span className="flex-1 min-w-0">
                                            <span className={`block text-sm font-medium ${d.void ? "text-slate-400 line-through" : "text-slate-800"}`}>{TYPE_LABEL[d.type as keyof typeof TYPE_LABEL] ?? "Invoice"} {d.number} · {dateShort(d.date)}</span>
                                            {d.vehicle && <span className="block truncate text-xs text-slate-500">{d.vehicle}</span>}
                                        </span>
                                        <span className="text-right">
                                            <span className="block text-sm tabular-nums text-slate-700">{money(Math.abs(d.total), workshop.currency)}</span>
                                            <span className={`block text-xs ${d.void ? "text-slate-400" : d.outstanding > 0 ? "text-amber-700 font-medium" : "text-teal-700"}`}>
                                                {d.void ? "Cancelled" : d.outstanding > 0 ? `${money(d.outstanding, workshop.currency)} due` : d.type === "CREDIT" ? "Credit" : "Paid"}
                                            </span>
                                        </span>
                                        <ChevronRight className="h-4 w-4 text-slate-300" />
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </Section>
                )}

                {data.inspections.filter((i) => i.waiting === 0).length > 0 && (
                    <Section title="Inspections" icon={<ClipboardCheck className="h-4 w-4" />}>
                        <ul className="divide-y divide-slate-100">
                            {data.inspections.filter((i) => i.waiting === 0).map((i) => (
                                <li key={i.id}>
                                    <Go to={links.inspection(i.id)} className="flex items-center gap-3 px-4 py-3">
                                        <span className="flex-1 text-sm text-slate-700">{i.vehicle ?? "Vehicle"}{i.requestedAt ? ` · ${dateShort(i.requestedAt)}` : ""}</span>
                                        <span className="text-xs text-slate-500">{i.approved} of {i.flagged} approved</span>
                                        <ChevronRight className="h-4 w-4 text-slate-300" />
                                    </Go>
                                </li>
                            ))}
                        </ul>
                    </Section>
                )}

                {nothing && <p className="rounded-lg bg-white px-4 py-6 text-center text-sm text-slate-500">There is nothing on your account yet.</p>}

                <p className="pt-2 text-center text-xs text-slate-400">This page is private to you. Please don&rsquo;t forward the link.</p>
            </main>
        </div>
    );
}
