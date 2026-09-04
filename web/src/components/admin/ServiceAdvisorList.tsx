"use client";

import { User, Plus, Pencil, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";

// Mock Data matching the screenshot reference
const MOCK_ADVISORS = [
    { id: "1", name: "Oscar Shilipipo", phone: "0816550616", email: "oscar@gmail.com" },
];

export function ServiceAdvisorList() {
    return (
        <div className="w-full max-w-7xl mx-auto h-full flex flex-col">
            <Card className="rounded-none shadow-none border border-slate-200">
                {/* Header Section */}
                <CardHeader className="bg-slate-200 border-b py-2 px-4 flex flex-row items-center justify-between space-y-0 h-10">
                    <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-slate-600" />
                        <CardTitle className="text-sm text-slate-800 font-semibold">Service Advisors</CardTitle>
                    </div>

                    <div className="flex items-center justify-center">
                        {/* Plus Button */}
                        <button
                            className="text-slate-500 hover:text-slate-700 bg-transparent p-1"
                            onClick={() => window.location.href = '/demo-tenant/admin/service-advisors/new'}
                        >
                            <Plus className="w-5 h-5 font-bold" />
                        </button>
                    </div>
                </CardHeader>

                <CardContent className="p-0 flex-1 overflow-auto bg-white">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-white hover:bg-white text-xs border-b border-slate-200">
                                <TableHead className="w-[30%] text-slate-500 font-semibold pl-4">Name</TableHead>
                                <TableHead className="w-[30%] text-slate-500 font-semibold">Phone Number</TableHead>
                                <TableHead className="w-[30%] text-slate-500 font-semibold">Email</TableHead>
                                <TableHead className="w-[10%] text-right pr-4"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {MOCK_ADVISORS.map((advisor, i) => (
                                <TableRow
                                    key={advisor.id}
                                    className={`${i % 2 === 0 ? "bg-slate-50" : "bg-white"} hover:bg-slate-100 border-none transition-colors group cursor-pointer`}
                                >
                                    <TableCell className="text-slate-700 py-2 pl-4 text-sm font-medium">
                                        {advisor.name}
                                    </TableCell>
                                    <TableCell className="text-slate-600 py-2 text-sm">{advisor.phone}</TableCell>
                                    <TableCell className="text-slate-600 py-2 text-sm">{advisor.email}</TableCell>
                                    <TableCell className="text-right py-2 pr-4">
                                        <div className="flex justify-end gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                                            {/* Action Icon: Edit */}
                                            <Button
                                                size="icon"
                                                variant="outline"
                                                onClick={() => window.location.href = `/demo-tenant/admin/service-advisors/${advisor.id}`}
                                                className="w-7 h-6 px-0 bg-white rounded-sm border-teal-500 text-teal-500 hover:bg-teal-50 shadow-sm"
                                            >
                                                <Pencil className="w-3.5 h-3.5" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>

                {/* Footer Pagination */}
                <div className="flex items-center justify-end px-4 py-3 bg-white border-t border-slate-200">
                    <div className="flex items-center border rounded border-slate-200 overflow-hidden bg-white shadow-sm h-8">
                        <span className="px-3 py-1 text-xs text-slate-800 font-semibold border-r border-slate-200 h-full flex items-center">
                            10 records
                        </span>
                        <button className="px-3 py-1 text-xs text-slate-400 hover:bg-slate-50 border-r border-slate-200 disabled:opacity-50 h-full">First Page</button>
                        <button className="px-3 py-1 text-slate-400 hover:bg-slate-50 border-r border-slate-200 disabled:opacity-50 h-full flex items-center justify-center">
                            <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                        <button className="px-4 py-1 text-xs text-teal-600 font-semibold hover:bg-slate-50 border-r border-slate-200 h-full bg-slate-50">1</button>
                        <button className="px-3 py-1 text-slate-400 hover:bg-slate-50 border-r border-slate-200 disabled:opacity-50 h-full flex items-center justify-center">
                            <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                        <button className="px-3 py-1 text-xs text-slate-400 hover:bg-slate-50 disabled:opacity-50 h-full">Last Page</button>
                    </div>
                </div>
            </Card>
        </div>
    );
}
