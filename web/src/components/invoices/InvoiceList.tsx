"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, FileText, ArrowUpRight, Filter } from "lucide-react";
import Link from "next/link";

// Mock Data
const MOCK_INVOICES = [
    { id: "inv_1", number: "INV-8439", date: new Date().setDate(new Date().getDate() - 2), customer: "Sarah Connor", vehicle: "Toyota Hilux", amount: 485.50, status: "PAID" },
    { id: "inv_2", number: "INV-8440", date: new Date().setDate(new Date().getDate() - 1), customer: "John Wick", vehicle: "Ford Mustang", amount: 1250.00, status: "SENT" },
    { id: "inv_3", number: "INV-8441", date: new Date(), customer: "Bruce Wayne", vehicle: "Batmobile", amount: 9500.00, status: "DRAFT" },
    { id: "inv_4", number: "INV-8430", date: new Date().setDate(new Date().getDate() - 25), customer: "Tony Stark", vehicle: "Audi R8", amount: 340.20, status: "OVERDUE" },
];

export function InvoiceList({ tenant }: { tenant: string }) {
    const [searchTerm, setSearchTerm] = useState("");

    const filteredInvoices = MOCK_INVOICES.filter(inv =>
        inv.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inv.number.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'PAID': return <Badge className="bg-green-100 text-green-800 border-green-200">Paid</Badge>;
            case 'SENT': return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Sent</Badge>;
            case 'OVERDUE': return <Badge className="bg-red-100 text-red-800 border-red-200">Overdue</Badge>;
            default: return <Badge variant="secondary">Draft</Badge>;
        }
    };

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex items-center justify-between bg-white p-2 rounded-lg border shadow-sm">
                <div className="relative w-72">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                    <Input
                        placeholder="Search invoices or customers..."
                        className="pl-9 bg-slate-50 border-transparent focus-visible:bg-white"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex gap-2">
                    <Button variant="outline"><Filter className="w-4 h-4 mr-2" /> Filter</Button>
                    <Link href={`/${tenant}/dashboard/invoices/new`}>
                        <Button className="bg-blue-600 hover:bg-blue-700">Create Invoice</Button>
                    </Link>
                </div>
            </div>

            {/* Data Table */}
            <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                <Table>
                    <TableHeader className="bg-slate-50">
                        <TableRow>
                            <TableHead className="w-[120px]">Invoice #</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Customer</TableHead>
                            <TableHead>Vehicle</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredInvoices.map((invoice) => (
                            <TableRow key={invoice.id} className="hover:bg-slate-50/50">
                                <TableCell className="font-medium text-slate-900">
                                    <Link href={`/${tenant}/dashboard/invoices/${invoice.id}`} className="hover:text-blue-600 flex items-center gap-1 group">
                                        <FileText className="w-4 h-4 text-slate-400 group-hover:text-blue-500" />
                                        {invoice.number}
                                    </Link>
                                </TableCell>
                                <TableCell className="text-slate-500">{format(new Date(invoice.date), "MMM d, yyyy")}</TableCell>
                                <TableCell className="font-medium">{invoice.customer}</TableCell>
                                <TableCell className="text-slate-500">{invoice.vehicle}</TableCell>
                                <TableCell className="font-semibold">${invoice.amount.toFixed(2)}</TableCell>
                                <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                                <TableCell className="text-right">
                                    <Link href={`/${tenant}/dashboard/invoices/${invoice.id}`}>
                                        <Button variant="ghost" size="sm" className="text-blue-600">
                                            View <ArrowUpRight className="w-4 h-4 ml-1" />
                                        </Button>
                                    </Link>
                                </TableCell>
                            </TableRow>
                        ))}

                        {filteredInvoices.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={7} className="h-32 text-center text-slate-500">
                                    No invoices found matching &quot;{searchTerm}&quot;
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
