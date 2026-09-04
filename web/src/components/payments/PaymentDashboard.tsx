"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { UploadCloud, FileText, CheckCircle2, Search, ArrowUpRight, DollarSign, Clock } from "lucide-react";

// Mock Data representing Unpaid Invoices and Logged Payments
const MOCK_AWAITING_PAYMENTS = [
    { id: "inv_1", number: "INV-8440", customer: "John Wick", amount_due: 1250.00, due_date: new Date().setDate(new Date().getDate() + 5), status: "SENT" },
    { id: "inv_2", number: "INV-8430", customer: "Tony Stark", amount_due: 340.20, due_date: new Date().setDate(new Date().getDate() - 25), status: "OVERDUE" },
];

const MOCK_PAYMENT_HISTORY = [
    { id: "pay_1", invoice_ref: "INV-8439", amount: 485.50, method: "EFT", date: new Date().setDate(new Date().getDate() - 1), status: "COMPLETED", has_proof: true },
    { id: "pay_2", invoice_ref: "INV-8438", amount: 150.00, method: "COD", date: new Date().setDate(new Date().getDate() - 3), status: "COMPLETED", has_proof: false },
    { id: "pay_3", invoice_ref: "INV-8445", amount: 2000.00, method: "EFT", date: new Date(), status: "PENDING", has_proof: true }, // Pending reconciliation
];

export function PaymentDashboard() {
    const [searchTerm, setSearchTerm] = useState("");
    const [isConfirming, setIsConfirming] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setSelectedFile(e.target.files[0]);
        }
    };

    const submitPayment = (e: React.FormEvent) => {
        e.preventDefault();
        console.log("Submitting Payment Record. Simulating S3 upload for:", selectedFile?.name);
        setIsConfirming(false);
        setSelectedFile(null);
    };

    return (
        <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-12">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* Quick Stats */}
                <Card className="bg-white">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium text-slate-500">Awaiting Reconciliation</CardTitle>
                        <Clock className="h-4 w-4 text-amber-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">1</div>
                        <p className="text-xs text-slate-500">Payments needing admin approval</p>
                    </CardContent>
                </Card>
                <Card className="bg-white">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium text-slate-500">Overdue Revenue</CardTitle>
                        <DollarSign className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">$340.20</div>
                        <p className="text-xs text-slate-500">Across 1 invoice</p>
                    </CardContent>
                </Card>
                <Card className="bg-white">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium text-slate-500">Collected (30d)</CardTitle>
                        <CheckCircle2 className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-600">$2,635.50</div>
                        <p className="text-xs text-slate-500">Total settled payments</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Awaiting Payments View */}
                <Card className="flex flex-col h-[500px]">
                    <CardHeader className="border-b pb-4">
                        <CardTitle>Invoices Awaiting Payment</CardTitle>
                        <CardDescription>Select an open invoice to record a payment against it.</CardDescription>
                        <div className="relative mt-2">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                            <Input
                                placeholder="Search by customer or INV #..."
                                className="pl-9 h-9 text-sm"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-auto p-0">
                        <div className="divide-y">
                            {MOCK_AWAITING_PAYMENTS.map((invoice) => (
                                <div key={invoice.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-semibold">{invoice.number}</span>
                                            <Badge variant="outline" className={`text-[10px] h-4 px-1.5 ${invoice.status === 'OVERDUE' ? 'text-red-600 border-red-200 bg-red-50' : ''}`}>
                                                {invoice.status}
                                            </Badge>
                                        </div>
                                        <p className="text-sm text-slate-600">{invoice.customer}</p>
                                    </div>
                                    <div className="text-right flex items-center gap-4">
                                        <div className="font-bold text-lg">${invoice.amount_due.toFixed(2)}</div>

                                        {/* Record Payment Dialog */}
                                        <Dialog open={isConfirming} onOpenChange={setIsConfirming}>
                                            <DialogTrigger asChild>
                                                <Button size="sm">Record Pay</Button>
                                            </DialogTrigger>
                                            <DialogContent>
                                                <DialogHeader>
                                                    <DialogTitle>Record Payment for {invoice.number}</DialogTitle>
                                                    <DialogDescription>
                                                        Attach proof of payment (PDF/Image) for EFTs, or log a Cash transaction.
                                                    </DialogDescription>
                                                </DialogHeader>
                                                <form onSubmit={submitPayment} className="space-y-4 pt-4">
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="space-y-2">
                                                            <Label>Payment Method</Label>
                                                            <Select defaultValue="EFT">
                                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="EFT">Bank Transfer (EFT)</SelectItem>
                                                                    <SelectItem value="COD">Cash on Delivery</SelectItem>
                                                                    <SelectItem value="CARD">Card Terminal</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label>Amount Received</Label>
                                                            <Input type="number" step="0.01" defaultValue={invoice.amount_due} />
                                                        </div>
                                                    </div>

                                                    <div className="space-y-2">
                                                        <Label>Bank Reference (if EFT)</Label>
                                                        <Input placeholder="e.g., Transfer from J. Wick" />
                                                    </div>

                                                    <div className="space-y-2 pt-2">
                                                        <Label>Proof of Payment Document</Label>
                                                        <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 flex flex-col items-center justify-center bg-slate-50 hover:bg-slate-100 transition-colors">
                                                            <UploadCloud className="h-8 w-8 text-slate-400 mb-2" />
                                                            <p className="text-sm text-slate-600 mb-4 font-medium">
                                                                {selectedFile ? selectedFile.name : "Drag & drop PDF/Image here or click to browse"}
                                                            </p>
                                                            <Input id="proof-upload" type="file" className="hidden" accept=".pdf,image/*" onChange={handleFileUpload} />
                                                            <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById('proof-upload')?.click()}>
                                                                Browse Files
                                                            </Button>
                                                            <p className="text-xs text-slate-400 mt-2">Max limit 5MB. Formats: .pdf, .jpeg, .png</p>
                                                        </div>
                                                    </div>

                                                    <div className="flex justify-end gap-2 pt-2">
                                                        <Button type="button" variant="ghost" onClick={() => setIsConfirming(false)}>Cancel</Button>
                                                        <Button type="submit" className="bg-green-600 hover:bg-green-700">Confirm Ledger Entry</Button>
                                                    </div>
                                                </form>
                                            </DialogContent>
                                        </Dialog>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Recent Transactions Vault */}
                <Card className="flex flex-col h-[500px]">
                    <CardHeader className="border-b pb-4">
                        <CardTitle>Recent Ledger Transactions</CardTitle>
                        <CardDescription>Historical log of settled and pending payments.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-auto p-0">
                        <Table>
                            <TableHeader className="bg-slate-50 sticky top-0">
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Invoice Ref</TableHead>
                                    <TableHead>Method</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {MOCK_PAYMENT_HISTORY.map((payment) => (
                                    <TableRow key={payment.id}>
                                        <TableCell className="text-slate-500 whitespace-nowrap">
                                            {new Date(payment.date).toLocaleDateString()}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1 font-medium">
                                                {payment.invoice_ref}
                                                {payment.has_proof && <span title="Proof Document Attached" className="flex items-center"><FileText className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" /></span>}
                                                {payment.status === 'PENDING' && <AlertBadge />}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="secondary" className="text-[10px]">{payment.method}</Badge>
                                        </TableCell>
                                        <TableCell className="text-right font-medium">
                                            ${payment.amount.toFixed(2)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

            </div>
        </div>
    );
}

function AlertBadge() {
    return <span className="inline-flex items-center rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20 ml-2">Pending</span>;
}
