"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, ShieldAlert, Car, CalendarCheck, ArrowUpRight, CheckCircle2, AlertTriangle, DownloadCloud } from "lucide-react";
import Link from "next/link";

// Mock Customer Data Payload
const CUSTOMER_DATA = {
    name: "John Wick",
    email: "john@continental.com",
    phone: "+1 555-0199",
    vehicles: [
        { id: "v1", make: "Ford", model: "Mustang Boss 429", year: 1969, rego: "JW-1969", nextService: new Date(new Date().setMonth(new Date().getMonth() + 2)) }
    ],
    invoices: [
        { id: "inv_8440", number: "INV-8440", date: new Date().setDate(new Date().getDate() - 1), amount: 1250.00, status: "UNPAID", vehicle: "Ford Mustang", due: new Date().setDate(new Date().getDate() + 5) },
        { id: "inv_8390", number: "INV-8390", date: new Date().setDate(new Date().getDate() - 45), amount: 340.00, status: "PAID", vehicle: "Ford Mustang", due: new Date().setDate(new Date().getDate() - 30) }
    ],
    inspections: [
        { id: "insp_99", date: new Date().setDate(new Date().getDate() - 1), vehicle: "Ford Mustang", status: "ACTION_REQUIRED", failedItems: 2 }
    ]
};

export function CustomerPortalView({ tenant, customerId }: { tenant: string, customerId: string }) {

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Minimal Customer Header */}
            <header className="bg-white border-b sticky top-0 z-10">
                <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-600 rounded-md flex items-center justify-center text-white font-bold">
                            {tenant.substring(0, 1).toUpperCase()}
                        </div>
                        <span className="font-semibold text-slate-800">{tenant.toUpperCase()} Auto Service</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-slate-500 hidden sm:inline-block">Welcome back, {CUSTOMER_DATA.name}</span>
                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-sm font-medium text-slate-600">
                            {CUSTOMER_DATA.name.split(' ').map(n => n[0]).join('')}
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-5xl mx-auto px-4 py-8">

                {/* Actionable Alerts Banner */}
                {CUSTOMER_DATA.invoices.some(i => i.status === 'UNPAID') && (
                    <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between shadow-sm">
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
                            <div>
                                <h3 className="text-sm font-semibold text-amber-800">Payment Due</h3>
                                <p className="text-xs text-amber-700 mt-1">You have 1 open invoice totaling $1,250.00 due soon.</p>
                            </div>
                        </div>
                        <Button size="sm" className="bg-amber-600 hover:bg-amber-700 w-full sm:w-auto">View Invoice</Button>
                    </div>
                )}

                <Tabs defaultValue="invoices" className="space-y-6">
                    <TabsList className="bg-white border w-full justify-start h-12 p-1 overflow-x-auto">
                        <TabsTrigger value="invoices" className="data-[state=active]:bg-slate-100 flex-1 sm:flex-none">
                            <FileText className="w-4 h-4 mr-2" /> Invoices
                        </TabsTrigger>
                        <TabsTrigger value="inspections" className="data-[state=active]:bg-slate-100 flex-1 sm:flex-none relative">
                            <ShieldAlert className="w-4 h-4 mr-2" /> Inspections
                            {CUSTOMER_DATA.inspections.some(i => i.status === 'ACTION_REQUIRED') && (
                                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-500"></span>
                            )}
                        </TabsTrigger>
                        <TabsTrigger value="vehicles" className="data-[state=active]:bg-slate-100 flex-1 sm:flex-none">
                            <Car className="w-4 h-4 mr-2" /> My Garage
                        </TabsTrigger>
                    </TabsList>

                    {/* Invoices Tab */}
                    <TabsContent value="invoices" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Billing History</CardTitle>
                                <CardDescription>View, download, and pay your workshop invoices.</CardDescription>
                            </CardHeader>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader className="bg-slate-50">
                                        <TableRow>
                                            <TableHead className="pl-6">Invoice</TableHead>
                                            <TableHead>Date</TableHead>
                                            <TableHead>Amount</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {CUSTOMER_DATA.invoices.map((inv) => (
                                            <TableRow key={inv.id}>
                                                <TableCell className="pl-6 font-medium">
                                                    <div>{inv.number}</div>
                                                    <div className="text-xs text-slate-500 font-normal">{inv.vehicle}</div>
                                                </TableCell>
                                                <TableCell className="text-slate-600">{format(new Date(inv.date), "MMM d, yyyy")}</TableCell>
                                                <TableCell className="font-semibold">${inv.amount.toFixed(2)}</TableCell>
                                                <TableCell>
                                                    {inv.status === 'PAID'
                                                        ? <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-transparent"><CheckCircle2 className="w-3 h-3 mr-1" /> Paid</Badge>
                                                        : <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-transparent">Due in 5 days</Badge>
                                                    }
                                                </TableCell>
                                                <TableCell className="text-right pr-6">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <Button variant="ghost" size="icon" className="text-slate-400 hover:text-blue-600"><DownloadCloud className="w-4 h-4" /></Button>
                                                        <Button variant="outline" size="sm" className="hidden sm:flex">View Details</Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Inspections Tab */}
                    <TabsContent value="inspections" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Health Reports</CardTitle>
                                <CardDescription>Digital inspection records detailing your vehicle&apos;s condition.</CardDescription>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="divide-y">
                                    {CUSTOMER_DATA.inspections.map((insp) => (
                                        <div key={insp.id} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
                                            <div className="flex items-start gap-4">
                                                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                                                    <ShieldAlert className="w-5 h-5 text-red-600" />
                                                </div>
                                                <div>
                                                    <h4 className="font-semibold">{insp.vehicle} - Multi-Point Inspection</h4>
                                                    <p className="text-sm text-slate-500 mt-1">Performed on {format(new Date(insp.date), "MMMM d, yyyy")}</p>
                                                    {insp.status === 'ACTION_REQUIRED' && (
                                                        <div className="mt-2 text-sm font-medium text-red-600 flex items-center gap-1">
                                                            <AlertTriangle className="w-4 h-4" />
                                                            {insp.failedItems} items require your approval to proceed with repair.
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <Button className="w-full sm:w-auto bg-slate-900 border-slate-900 shadow-sm text-white hover:bg-slate-800">
                                                Review Report <ArrowUpRight className="w-4 h-4 ml-2 opacity-70" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Vehicles Garage */}
                    <TabsContent value="vehicles" className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {CUSTOMER_DATA.vehicles.map((v) => (
                                <Card key={v.id} className="overflow-hidden">
                                    <div className="h-2 bg-blue-600 w-full"></div>
                                    <CardHeader className="pb-2">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <CardTitle className="text-lg">{v.year} {v.make}</CardTitle>
                                                <CardDescription className="text-base text-slate-800 font-medium mt-1">{v.model}</CardDescription>
                                            </div>
                                            <Badge variant="outline" className="font-mono bg-slate-100">{v.rego}</Badge>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="pt-4 border-t mt-4 bg-slate-50 flex items-center justify-between">
                                        <div className="text-sm">
                                            <span className="text-slate-500 block mb-1">Next Recommended Service</span>
                                            <span className="font-medium text-slate-900 flex items-center gap-1.5">
                                                <CalendarCheck className="w-4 h-4 text-blue-600" />
                                                {format(v.nextService, "MMMM yyyy")}
                                            </span>
                                        </div>
                                        <Link href={`/${tenant}/book`}>
                                            <Button variant="outline" size="sm">Book Now</Button>
                                        </Link>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </TabsContent>

                </Tabs>
            </main>
        </div>
    );
}
