"use client";

import { useParams } from "next/navigation";

import { useState } from "react";
import { Search, X, Plus, Pencil, User, MessageSquare, Settings, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

// Mock Data matching the screenshot reference
const MOCK_MECHANICS = [
    { id: "1", name: "Edit Me Mechanic 1", mobile: "" },
    { id: "2", name: "Edit Me Mechanic 2", mobile: "" },
    { id: "3", name: "Edit Me Mechanic 3", mobile: "" },
];

export function MechanicList() {
    const { tenant } = useParams<{ tenant: string }>();
    const [searchTerm, setSearchTerm] = useState("");
    const [showActiveOnly, setShowActiveOnly] = useState(true);

    return (
        <div className="w-full max-w-7xl mx-auto h-full flex flex-col">
            <Card className="rounded-none shadow-none border border-slate-200">
                {/* Header Section */}
                <CardHeader className="bg-slate-200 border-b py-2 px-4 flex flex-row items-center justify-between space-y-0 h-14">
                    <div className="flex items-center gap-3">
                        <Settings className="w-5 h-5 text-slate-600" />
                        <CardTitle className="text-lg text-slate-800 font-bold">Mechanics</CardTitle>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Active Toggle */}
                        <div className="flex items-center bg-white rounded-full border border-slate-300 px-3 py-1 gap-2 shrink-0 shadow-sm">
                            <Switch
                                checked={showActiveOnly}
                                onCheckedChange={setShowActiveOnly}
                                className="data-[state=checked]:bg-teal-500 scale-75 origin-left"
                            />
                            <span className="text-[10px] font-bold text-teal-600 uppercase tracking-wider mr-1">Active</span>
                        </div>

                        {/* Search Input */}
                        <div className="relative w-64">
                            <Input
                                type="text"
                                placeholder="Filter..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-3 pr-8 py-1 h-8 rounded-sm bg-white border-slate-300 shadow-sm text-sm focus-visible:ring-1 focus-visible:ring-teal-500"
                            />
                            {searchTerm && (
                                <button
                                    onClick={() => setSearchTerm("")}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>

                        {/* Plus Button */}
                        <Button
                            size="icon"
                            variant="outline"
                            className="w-8 h-8 rounded-sm bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-600 shadow-sm"
                            onClick={() => window.location.href = `/${tenant}/admin/mechanics/new`}
                        >
                            <Plus className="w-5 h-5" />
                        </Button>
                    </div>
                </CardHeader>

                <CardContent className="p-0 flex-1 overflow-auto bg-white">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-white hover:bg-white text-xs border-b border-slate-200">
                                <TableHead className="w-[50%] text-slate-500 font-semibold pl-4">Name</TableHead>
                                <TableHead className="w-[30%] text-slate-500 font-semibold">Mobile</TableHead>
                                <TableHead className="w-[20%] text-right pr-4"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {MOCK_MECHANICS.map((mechanic, i) => (
                                <TableRow
                                    key={mechanic.id}
                                    className={`${i % 2 === 0 ? "bg-slate-50" : "bg-white"} hover:bg-slate-100 border-none transition-colors group cursor-pointer`}
                                >
                                    <TableCell className="text-slate-700 py-2.5 pl-4 text-sm font-medium">
                                        {mechanic.name}
                                    </TableCell>
                                    <TableCell className="text-slate-600 py-2.5 text-sm">{mechanic.mobile}</TableCell>
                                    <TableCell className="text-right py-2.5 pr-4">
                                        <div className="flex justify-end gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                                            {/* Action Icon: Edit */}
                                            <Button
                                                size="icon"
                                                variant="outline"
                                                onClick={() => window.location.href = `/${tenant}/admin/mechanics/${mechanic.id}`}
                                                className="w-8 h-7 px-0 rounded-sm border-teal-500 text-teal-500 hover:bg-teal-50 shadow-sm"
                                            >
                                                <Pencil className="w-4 h-4" />
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
                            {MOCK_MECHANICS.length > 2 ? 10 : MOCK_MECHANICS.length} records
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
