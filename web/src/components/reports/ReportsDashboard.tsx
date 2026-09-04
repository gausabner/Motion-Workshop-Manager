"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart3, TrendingUp, Users, Clock, AlertTriangle, DownloadCloud, DollarSign, Briefcase, RefreshCw, BarChart2, ArrowRightLeft, ChevronLeft, ChevronRight, CalendarDays, CalendarRange, Wrench, CalendarClock, Inbox, ShoppingCart, Bell, Repeat } from "lucide-react";

// Mock Data
const MOCK_REVENUE = {
    total: 45230.50,
    parts: 28500.00,
    labor: 16730.50,
    growth: "+12.5%",
    dailyData: [
        { day: 'Mon', parts: 1200, labor: 800 },
        { day: 'Tue', parts: 1500, labor: 950 },
        { day: 'Wed', parts: 900, labor: 1100 },
        { day: 'Thu', parts: 2100, labor: 1400 },
        { day: 'Fri', parts: 1800, labor: 1200 },
        { day: 'Sat', parts: 800, labor: 600 },
        { day: 'Sun', parts: 0, labor: 0 },
    ]
};

const MOCK_PRODUCTIVITY = [
    { id: "tech_1", name: "Mike R.", role: "Senior Mechanic", hoursClocked: 38, hoursBilled: 35, efficiency: 92 },
    { id: "tech_2", name: "Sarah K.", role: "Service Tech", hoursClocked: 40, hoursBilled: 42, efficiency: 105 },
    { id: "tech_3", name: "Dave B.", role: "Apprentice", hoursClocked: 25, hoursBilled: 15, efficiency: 60 },
];

const MOCK_AGING = {
    current: 12500.00,
    thirtyDays: 4200.00,
    sixtyDays: 1850.00,
    ninetyPlus: 640.00,
    totalOutstanding: 19190.00,
    topDebtors: [
        { name: "Stark Industries", invoice: "INV-8430", amount: 640.00, daysOverdue: 94 },
        { name: "Wayne Enterprises", invoice: "INV-8412", amount: 1850.00, daysOverdue: 62 },
        { name: "John Wick", invoice: "INV-8440", amount: 1250.00, daysOverdue: 35 }
    ]
};

const MOCK_RECENT_ACTIVITY = {
    transactions: [
        { user: "gausabner@gmail.com", transaction: "Invoice updated for Sameera Moses", date: "20/02/2026" },
        { user: "gausabner@gmail.com", transaction: "Booking 60000 updated for date Mar 02", date: "20/02/2026" },
        { user: "gausabner@gmail.com", transaction: "Booking 60000 created for date Mar 02", date: "20/02/2026" },
    ]
};

export function ReportsDashboard() {

    return (
        <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-12">

            {/* Global KPI Ribbon (Refined 9-Grid per requested references) */}
            {/* Global KPI Ribbon (Minimalistic & Clean Design) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* Row 1 - Sales/Jobs */}
                <Card className="bg-white border border-slate-100 shadow-sm rounded-xl p-5 hover:shadow-md transition-shadow flex flex-col items-center justify-center text-center gap-3 cursor-pointer">
                    <div className="w-12 h-12 rounded-full bg-teal-50 flex items-center justify-center shrink-0">
                        <Briefcase className="w-5 h-5 text-teal-600" strokeWidth={1.5} />
                    </div>
                    <div>
                        <p className="text-xs text-slate-500 font-medium tracking-wide uppercase">Today's Jobs</p>
                        <h3 className="text-2xl font-bold text-slate-800 mt-0.5">0</h3>
                    </div>
                </Card>
                <Card className="bg-white border border-slate-100 shadow-sm rounded-xl p-5 hover:shadow-md transition-shadow flex flex-col items-center justify-center text-center gap-3 cursor-pointer">
                    <div className="w-12 h-12 rounded-full bg-sky-50 flex items-center justify-center shrink-0">
                        <CalendarDays className="w-5 h-5 text-sky-600" strokeWidth={1.5} />
                    </div>
                    <div>
                        <p className="text-xs text-slate-500 font-medium tracking-wide uppercase">Past Week Jobs</p>
                        <h3 className="text-2xl font-bold text-slate-800 mt-0.5">0</h3>
                    </div>
                </Card>
                <Card className="bg-white border border-slate-100 shadow-sm rounded-xl p-5 hover:shadow-md transition-shadow flex flex-col items-center justify-center text-center gap-3 cursor-pointer">
                    <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center shrink-0">
                        <CalendarRange className="w-5 h-5 text-indigo-600" strokeWidth={1.5} />
                    </div>
                    <div>
                        <p className="text-xs text-slate-500 font-medium tracking-wide uppercase">Past Month Jobs</p>
                        <h3 className="text-2xl font-bold text-slate-800 mt-0.5">0</h3>
                    </div>
                </Card>

                {/* Row 2 - Open Items */}
                <Card className="bg-white border border-slate-100 shadow-sm rounded-xl p-5 hover:shadow-md transition-shadow flex flex-col items-center justify-center text-center gap-3 cursor-pointer">
                    <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center shrink-0">
                        <Wrench className="w-5 h-5 text-amber-600" strokeWidth={1.5} />
                    </div>
                    <div>
                        <p className="text-xs text-slate-500 font-medium tracking-wide uppercase">Open Jobs</p>
                        <h3 className="text-2xl font-bold text-slate-800 mt-0.5">1</h3>
                    </div>
                </Card>
                <Card className="bg-white border border-slate-100 shadow-sm rounded-xl p-5 hover:shadow-md transition-shadow flex flex-col items-center justify-center text-center gap-3 cursor-pointer">
                    <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center shrink-0">
                        <CalendarClock className="w-5 h-5 text-rose-600" strokeWidth={1.5} />
                    </div>
                    <div>
                        <p className="text-xs text-slate-500 font-medium tracking-wide uppercase">Open Bookings</p>
                        <h3 className="text-2xl font-bold text-slate-800 mt-0.5">0</h3>
                    </div>
                </Card>
                <Card className="bg-white border border-slate-100 shadow-sm rounded-xl p-5 hover:shadow-md transition-shadow flex flex-col items-center justify-center text-center gap-3 cursor-pointer">
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                        <Inbox className="w-5 h-5 text-slate-600" strokeWidth={1.5} />
                    </div>
                    <div>
                        <p className="text-xs text-slate-500 font-medium tracking-wide uppercase">Unassigned Bookings</p>
                        <h3 className="text-2xl font-bold text-slate-800 mt-0.5">0</h3>
                    </div>
                </Card>

                {/* Row 3 - Reminders & Renewals */}
                <Card className="bg-white border border-slate-100 shadow-sm rounded-xl p-5 hover:shadow-md transition-shadow flex flex-col items-center justify-center text-center gap-3 cursor-pointer">
                    <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
                        <ShoppingCart className="w-5 h-5 text-emerald-600" strokeWidth={1.5} />
                    </div>
                    <div>
                        <p className="text-xs text-slate-500 font-medium tracking-wide uppercase">Open Orders</p>
                        <h3 className="text-2xl font-bold text-slate-800 mt-0.5">0</h3>
                    </div>
                </Card>
                <Card className="bg-white border border-slate-100 shadow-sm rounded-xl p-5 hover:shadow-md transition-shadow flex flex-col items-center justify-center text-center gap-3 cursor-pointer">
                    <div className="w-12 h-12 rounded-full bg-violet-50 flex items-center justify-center shrink-0">
                        <Bell className="w-5 h-5 text-violet-600" strokeWidth={1.5} />
                    </div>
                    <div>
                        <p className="text-xs text-slate-500 font-medium tracking-wide uppercase">{format(new Date(), 'MMMM')} Service Reminders</p>
                        <h3 className="text-2xl font-bold text-slate-800 mt-0.5">0</h3>
                    </div>
                </Card>
                <Card className="bg-white border border-slate-100 shadow-sm rounded-xl p-5 hover:shadow-md transition-shadow flex flex-col items-center justify-center text-center gap-3 cursor-pointer">
                    <div className="w-12 h-12 rounded-full bg-fuchsia-50 flex items-center justify-center shrink-0">
                        <Repeat className="w-5 h-5 text-fuchsia-600" strokeWidth={1.5} />
                    </div>
                    <div>
                        <p className="text-xs text-slate-500 font-medium tracking-wide uppercase">{format(new Date(), 'MMM')} Renewals</p>
                        <h3 className="text-2xl font-bold text-slate-800 mt-0.5">0</h3>
                    </div>
                </Card>
            </div>

            {/* Recent Activity Section */}
            <Card className="bg-white border shadow-sm rounded-none overflow-hidden mt-2 mb-2">
                <CardHeader className="bg-slate-200 border-b py-3 px-4 flex flex-row items-center gap-3 space-y-0">
                    <ArrowRightLeft className="w-5 h-5 text-slate-500" />
                    <CardTitle className="text-base text-slate-800 font-bold">Recent Activity</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <Tabs defaultValue="transactions" className="w-full">
                        <TabsList className="bg-transparent border-b w-full justify-start h-12 p-0 rounded-none px-4 space-x-4">
                            <TabsTrigger value="transactions" className="data-[state=active]:border-b-2 data-[state=active]:border-teal-600 data-[state=active]:text-teal-700 rounded-none h-full px-4 text-slate-600 font-medium bg-transparent shadow-none">Transactions</TabsTrigger>
                            <TabsTrigger value="jobs" className="data-[state=active]:border-b-2 data-[state=active]:border-teal-600 data-[state=active]:text-teal-700 rounded-none h-full px-4 text-slate-600 font-medium bg-transparent shadow-none">Jobs In Progress</TabsTrigger>
                            <TabsTrigger value="completed" className="data-[state=active]:border-b-2 data-[state=active]:border-teal-600 data-[state=active]:text-teal-700 rounded-none h-full px-4 text-slate-600 font-medium bg-transparent shadow-none">Recently Completed</TabsTrigger>
                        </TabsList>
                        <TabsContent value="transactions" className="p-0 m-0">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-white hover:bg-white text-xs border-b">
                                        <TableHead className="w-1/3 text-slate-500 pl-4">User</TableHead>
                                        <TableHead className="text-slate-500">Transaction</TableHead>
                                        <TableHead className="w-1/4 text-slate-500 pr-4">Date</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {MOCK_RECENT_ACTIVITY.transactions.map((t, i) => (
                                        <TableRow key={i} className={i % 2 === 0 ? "bg-slate-100 hover:bg-slate-100 border-none" : "bg-white hover:bg-white border-none"}>
                                            <TableCell className="text-slate-700 py-3 pl-4">{t.user}</TableCell>
                                            <TableCell className="text-slate-700 py-3">{t.transaction}</TableCell>
                                            <TableCell className="text-slate-700 py-3 pr-4">{t.date}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                            <div className="flex items-center justify-end px-4 py-3 bg-white gap-4 border-t">
                                <div className="flex items-center border rounded border-slate-200 overflow-hidden bg-white shadow-sm">
                                    <span className="px-3 py-1.5 text-xs text-slate-900 font-semibold border-r border-slate-200">5 records</span>
                                    <button className="px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-50 border-r border-slate-200 disabled:opacity-50">First Page</button>
                                    <button className="px-3 py-1.5 text-slate-400 hover:bg-slate-50 border-r border-slate-200 disabled:opacity-50 flex items-center justify-center"><ChevronLeft className="w-3.5 h-3.5" /></button>
                                    <button className="px-4 py-1.5 text-xs text-teal-600 font-semibold hover:bg-slate-50 border-r border-slate-200">1</button>
                                    <button className="px-3 py-1.5 text-slate-400 hover:bg-slate-50 border-r border-slate-200 disabled:opacity-50 flex items-center justify-center"><ChevronRight className="w-3.5 h-3.5" /></button>
                                    <button className="px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-50 disabled:opacity-50">Last Page</button>
                                </div>
                            </div>
                        </TabsContent>
                        <TabsContent value="jobs" className="p-8 text-center text-slate-500 text-sm">No jobs in progress.</TabsContent>
                        <TabsContent value="completed" className="p-8 text-center text-slate-500 text-sm">No recently completed jobs.</TabsContent>
                    </Tabs>
                </CardContent>
            </Card>

            <Tabs defaultValue="revenue" className="space-y-6">
                <TabsList className="bg-white border w-full justify-start h-12 p-1 overflow-x-auto">
                    <TabsTrigger value="revenue" className="data-[state=active]:bg-slate-100 flex-1 sm:flex-none">
                        <TrendingUp className="w-4 h-4 mr-2" /> Revenue Breakup
                    </TabsTrigger>
                    <TabsTrigger value="productivity" className="data-[state=active]:bg-slate-100 flex-1 sm:flex-none">
                        <Users className="w-4 h-4 mr-2" /> Tech Productivity
                    </TabsTrigger>
                    <TabsTrigger value="aging" className="data-[state=active]:bg-slate-100 flex-1 sm:flex-none">
                        <AlertTriangle className="w-4 h-4 mr-2" /> Aging Summary
                    </TabsTrigger>
                    <div className="flex-1"></div>
                    <Button variant="outline" size="sm" className="hidden sm:flex ml-4 mr-1">
                        <DownloadCloud className="w-4 h-4 mr-2" /> Export CSV
                    </Button>
                </TabsList>

                {/* Revenue Analytics */}
                <TabsContent value="revenue" className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <Card className="lg:col-span-2">
                            <CardHeader>
                                <CardTitle>Sales Trend (7 Days)</CardTitle>
                                <CardDescription>Daily breakdown of parts vs. labor revenue.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="h-64 flex items-end justify-between gap-2 pt-4 border-b pb-2">
                                    {/* Simple CSS Bar Chart for MVP */}
                                    {MOCK_REVENUE.dailyData.map((d, i) => {
                                        const maxVal = 4000; // Mock Max
                                        const partsHeight = `${(d.parts / maxVal) * 100}%`;
                                        const laborHeight = `${(d.labor / maxVal) * 100}%`;
                                        return (
                                            <div key={i} className="flex flex-col items-center flex-1 h-full justify-end group">
                                                <div className="w-full max-w-[40px] flex flex-col justify-end h-full gap-0.5">
                                                    <div
                                                        className="w-full bg-slate-300 rounded-t-sm transition-all group-hover:brightness-90"
                                                        style={{ height: partsHeight }}
                                                        title={`Parts: $${d.parts}`}
                                                    ></div>
                                                    <div
                                                        className="w-full bg-teal-500 rounded-b-sm transition-all group-hover:brightness-110"
                                                        style={{ height: laborHeight }}
                                                        title={`Labor: $${d.labor}`}
                                                    ></div>
                                                </div>
                                                <span className="text-xs text-slate-500 mt-2 font-medium">{d.day}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="flex items-center justify-center gap-6 mt-4">
                                    <div className="flex items-center gap-2 text-sm"><span className="w-3 h-3 rounded-full bg-slate-300"></span> Parts Sales</div>
                                    <div className="flex items-center gap-2 text-sm"><span className="w-3 h-3 rounded-full bg-teal-500"></span> Labor Sales</div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-none shadow-sm rounded-xl">
                            <CardHeader>
                                <CardTitle>Revenue Split</CardTitle>
                                <CardDescription>Month-to-Date distribution.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="flex flex-col items-center justify-center py-4">
                                    {/* CSS Donut representation via conic gradient fallback */}
                                    <div className="w-40 h-40 rounded-full relative flex items-center justify-center" style={{ background: `conic-gradient(#cbd5e1 ${Math.round((MOCK_REVENUE.parts / MOCK_REVENUE.total) * 100)}%, #14b8a6 0)` }}>
                                        <div className="w-28 h-28 bg-white rounded-full flex items-center justify-center flex-col shadow-inner">
                                            <span className="text-xs text-slate-500 font-medium">Total</span>
                                            <span className="text-lg font-bold text-slate-900">${(MOCK_REVENUE.total / 1000).toFixed(1)}k</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center text-sm">
                                        <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-slate-300"></span> Parts</div>
                                        <div className="font-semibold text-slate-700">${MOCK_REVENUE.parts.toFixed(2)}</div>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-teal-500"></span> Labor</div>
                                        <div className="font-semibold text-slate-700">${MOCK_REVENUE.labor.toFixed(2)}</div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* Productivity Analytics */}
                <TabsContent value="productivity" className="space-y-6">
                    <Card className="border-none shadow-sm rounded-xl overflow-hidden">
                        <CardHeader>
                            <CardTitle>Tech Productivity Report</CardTitle>
                            <CardDescription>Track billed hours versus actual clocked hours to determine shop efficiency.</CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader className="bg-slate-50">
                                    <TableRow>
                                        <TableHead className="pl-6 w-[30%]">Technician</TableHead>
                                        <TableHead>Clocked (Hrs)</TableHead>
                                        <TableHead>Billed (Hrs)</TableHead>
                                        <TableHead className="w-[30%]">Efficiency</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {MOCK_PRODUCTIVITY.map((tech) => (
                                        <TableRow key={tech.id}>
                                            <TableCell className="pl-6">
                                                <div className="font-medium text-slate-900">{tech.name}</div>
                                                <div className="text-xs text-slate-500">{tech.role}</div>
                                            </TableCell>
                                            <TableCell className="font-medium text-slate-600">{tech.hoursClocked}h</TableCell>
                                            <TableCell className="font-medium text-teal-600">{tech.hoursBilled}h</TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <div className="font-bold w-12 text-right">{tech.efficiency}%</div>
                                                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full ${tech.efficiency >= 100 ? 'bg-teal-500' : tech.efficiency > 80 ? 'bg-slate-400' : 'bg-amber-500'}`}
                                                            style={{ width: `${Math.min(tech.efficiency, 100)}%` }}
                                                        ></div>
                                                    </div>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Aging Accounts Receivable */}
                <TabsContent value="aging" className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card className="border-none shadow-sm rounded-xl">
                            <CardHeader>
                                <CardTitle>A/R Aging Summary</CardTitle>
                                <CardDescription>Outstanding invoice amounts grouped by days overdue.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-6">
                                    <div className="flex flex-col gap-2">
                                        <div className="flex justify-between items-end">
                                            <span className="text-sm font-medium text-slate-600">Current (Not Overdue)</span>
                                            <span className="font-bold text-slate-900">${MOCK_AGING.current.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                        </div>
                                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                            <div className="h-full bg-teal-500" style={{ width: `${(MOCK_AGING.current / MOCK_AGING.totalOutstanding) * 100}%` }}></div>
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <div className="flex justify-between items-end">
                                            <span className="text-sm font-medium text-slate-600">1 - 30 Days</span>
                                            <span className="font-bold text-slate-900">${MOCK_AGING.thirtyDays.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                        </div>
                                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                            <div className="h-full bg-slate-400" style={{ width: `${(MOCK_AGING.thirtyDays / MOCK_AGING.totalOutstanding) * 100}%` }}></div>
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <div className="flex justify-between items-end">
                                            <span className="text-sm font-medium text-slate-600">31 - 60 Days</span>
                                            <span className="font-bold text-slate-900">${MOCK_AGING.sixtyDays.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                        </div>
                                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                            <div className="h-full bg-amber-400" style={{ width: `${(MOCK_AGING.sixtyDays / MOCK_AGING.totalOutstanding) * 100}%` }}></div>
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <div className="flex justify-between items-end">
                                            <span className="text-sm font-medium text-red-600">90+ Days</span>
                                            <span className="font-bold text-red-600">${MOCK_AGING.ninetyPlus.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                        </div>
                                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                            <div className="h-full bg-red-500" style={{ width: `${(MOCK_AGING.ninetyPlus / MOCK_AGING.totalOutstanding) * 100}%` }}></div>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-none shadow-sm rounded-xl overflow-hidden">
                            <CardHeader>
                                <CardTitle className="text-red-700 flex items-center gap-2"><AlertTriangle className="w-5 h-5" /> Severe Debtors</CardTitle>
                                <CardDescription>Customers with invoices severely past due requiring follow-up.</CardDescription>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="divide-y border-t mt-2">
                                    {MOCK_AGING.topDebtors.map((debtor, i) => (
                                        <div key={i} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                                            <div>
                                                <div className="font-semibold text-slate-900">{debtor.name}</div>
                                                <div className="flex items-center gap-2 text-xs mt-1">
                                                    <Badge variant="outline" className="font-mono bg-white text-slate-500">{debtor.invoice}</Badge>
                                                    <span className="text-red-600 font-medium bg-red-50 px-2 py-0.5 rounded-md">{debtor.daysOverdue} Days Overdue</span>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="font-bold text-lg text-slate-900">${debtor.amount.toFixed(2)}</div>
                                                <Button variant="link" size="sm" className="h-6 px-0 text-teal-600 hover:text-teal-700 font-semibold">Send Reminder</Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

            </Tabs>
        </div>
    );
}
