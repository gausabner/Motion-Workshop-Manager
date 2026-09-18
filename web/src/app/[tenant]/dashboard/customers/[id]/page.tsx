import Link from "next/link";
import { notFound } from "next/navigation";
import { Car, Plus, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CustomerForm } from "@/components/customers/CustomerForm";
import { ArchiveCustomerButton } from "@/components/customers/ArchiveCustomerButton";
import { AccountSummary } from "@/components/payments/AccountSummary";
import { requireTenant } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { getCustomer, listCustomerSources } from "@/lib/customers/queries";
import { getCustomerAccount } from "@/lib/payments/queries";
import { listMessages } from "@/lib/messaging/queries";
import { MessageLog } from "@/components/messaging/MessageLog";
import { businessToday } from "@/lib/tenant/today";
import { dateShort } from "@/lib/format";

export default async function CustomerPage({ params, searchParams }: { params: Promise<{ tenant: string; id: string }>; searchParams: Promise<{ saved?: string }> }) {
    const [{ tenant: slug, id }, { saved }] = await Promise.all([params, searchParams]);
    const { db, tenant, membership } = await requireTenant(slug);
    const [customer, sources, account, messages] = await Promise.all([
        getCustomer(db, id), listCustomerSources(db), getCustomerAccount(db, id, businessToday(tenant.timezone)), listMessages(db, { customerId: id }, 25),
    ]);
    if (!customer) notFound();
    const base = `/${slug}/dashboard`;
    const today = new Date();
    const due = (d: Date | null) => d && d < new Date(today.getFullYear(), today.getMonth() + 1, today.getDate());

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <User className="w-6 h-6 text-slate-400" />
                    <div>
                        <h1 className="text-xl font-bold text-slate-800 leading-tight">{customer.firstName} {customer.lastName}</h1>
                        <p className="text-xs text-slate-500">
                            {customer.archivedAt ? <span className="text-amber-700 font-medium">Archived {dateShort(customer.archivedAt)} · </span> : null}
                            Customer since {dateShort(customer.createdAt)}{customer.customerSource ? ` · ${customer.customerSource.name}` : ""}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {saved && <span className="text-sm text-teal-700">Saved</span>}
                    <ArchiveCustomerButton tenant={slug} id={customer.id} archived={!!customer.archivedAt} />
                </div>
            </div>

            <AccountSummary tenant={slug} customerId={customer.id} account={account} canTakePayment={can(membership, "payments:take")} />

            <section id="vehicles" className="border border-slate-200 rounded-sm bg-white">
                <div className="flex items-center justify-between px-4 py-2 border-b bg-slate-50">
                    <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-2"><Car className="w-3.5 h-3.5" /> Vehicles</h2>
                    <Button asChild size="sm" variant="outline" className="h-7">
                        <Link href={`${base}/vehicles/new?customerId=${customer.id}`}><Plus className="w-3.5 h-3.5 mr-1" />Add vehicle</Link>
                    </Button>
                </div>
                {customer.vehicles.length === 0 ? (
                    <p className="px-4 py-4 text-sm text-slate-500">No vehicles on this account yet.</p>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow className="text-xs">
                                <TableHead className="pl-4">Plate</TableHead><TableHead>Vehicle</TableHead><TableHead className="text-right">Odometer</TableHead><TableHead>Licence disc</TableHead><TableHead>Roadworthy</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {customer.vehicles.map((v) => (
                                <TableRow key={v.id} className="text-sm">
                                    <TableCell className="pl-4"><Link href={`${base}/vehicles/${v.id}`} className="inline-block bg-yellow-100 border border-yellow-400 text-yellow-800 text-xs font-bold px-2 py-0.5 rounded">{v.plate}</Link></TableCell>
                                    <TableCell>{v.year ? `${v.year} ` : ""}{v.make} {v.model}</TableCell>
                                    <TableCell className="text-right tabular-nums">{v.odometer?.toLocaleString("en-NA") ?? ""}{v.odometer ? " km" : ""}</TableCell>
                                    <TableCell className={due(v.licenceExpiry) ? "text-amber-700 font-medium" : ""}>{dateShort(v.licenceExpiry)}</TableCell>
                                    <TableCell className={due(v.roadworthyExpiry) ? "text-amber-700 font-medium" : ""}>{dateShort(v.roadworthyExpiry)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </section>

            <MessageLog tenant={slug} rows={messages} />

            <CustomerForm tenant={slug} customer={customer} sources={sources} />
        </div>
    );
}
