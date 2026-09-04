// @ts-nocheck
"use client";

import { useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, FileDown, Send, Save, ArrowLeft, Receipt } from "lucide-react";
import Link from "next/link";

// Form Schema mimicking the Backend capabilities
const lineItemSchema = z.object({
    id: z.string().optional(),
    description: z.string().min(2, "Description required"),
    quantity: z.coerce.number().min(0.01),
    unitPrice: z.coerce.number().min(0),
    taxRate: z.coerce.number().min(0), // percentage, e.g., 15 for 15%
});

const invoiceSchema = z.object({
    invoiceNumber: z.string().min(1),
    issueDate: z.string(),
    dueDate: z.string(),
    status: z.enum(["DRAFT", "SENT", "PARTIAL", "PAID", "VOID", "OVERDUE"]),
    customerName: z.string().min(2),
    vehicleDetails: z.string(),
    notes: z.string().optional(),
    terms: z.string().optional(),
    lineItems: z.array(lineItemSchema).min(1, "At least one line item is required"),
});

type InvoiceFormValues = z.infer<typeof invoiceSchema>;

// Pre-filled data representing a conversion from a Job Card
const DEFAULT_INVOICE: Partial<InvoiceFormValues> = {
    invoiceNumber: `INV-${Math.floor(Math.random() * 10000)}`,
    issueDate: format(new Date(), "yyyy-MM-dd"),
    dueDate: format(new Date(new Date().setDate(new Date().getDate() + 14)), "yyyy-MM-dd"),
    status: "DRAFT",
    customerName: "Sarah Connor",
    vehicleDetails: "Toyota Hilux (T800-SKY)",
    notes: "Thank you for trusting MOTION Workshop.",
    terms: "Net 14 Days. Please remit payment via EFT.",
    lineItems: [
        { description: "Logbook Service - Minor", quantity: 1.5, unitPrice: 120.00, taxRate: 15 },
        { description: "Toyota 5W-30 Synthetic Oil (5L)", quantity: 1, unitPrice: 85.00, taxRate: 15 },
        { description: "Oil Filter", quantity: 1, unitPrice: 24.50, taxRate: 15 },
    ]
};

export function InvoiceGenerator({ invoiceId, tenant }: { invoiceId: string, tenant: string }) {
    const form = useForm<InvoiceFormValues>({
        resolver: zodResolver(invoiceSchema),
        defaultValues: DEFAULT_INVOICE,
        mode: "onChange",
    });

    const { fields, append, remove } = useFieldArray({
        name: "lineItems",
        control: form.control,
    });

    // Watch line items to calculate real-time totals
    const watchLineItems = form.watch("lineItems");

    const calculateTotals = () => {
        let subtotal = 0;
        let totalTax = 0;

        (watchLineItems || []).forEach(item => {
            const lineTotal = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
            const lineTax = lineTotal * ((Number(item.taxRate) || 0) / 100);

            subtotal += lineTotal;
            totalTax += lineTax;
        });

        return {
            subtotal,
            totalTax,
            totalAmount: subtotal + totalTax,
        };
    };

    const totals = calculateTotals();

    const onSubmit = (data: InvoiceFormValues) => {
        console.log("Saving Invoice:", { ...data, ...totals });
        // TODO: POST to backend
    };

    return (
        <div className="flex flex-col gap-6 max-w-6xl mx-auto pb-12">
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

                    {/* Action Header */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <Link href={`/${tenant}/dashboard/invoices`}>
                                <Button variant="outline" size="icon" type="button"><ArrowLeft className="w-4 h-4" /></Button>
                            </Link>
                            <div>
                                <h1 className="text-2xl font-bold tracking-tight">Invoice {form.watch("invoiceNumber")}</h1>
                                <p className="text-sm text-slate-500">Manage billing and issue tax documents.</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <Button variant="outline" type="button"><FileDown className="w-4 h-4 mr-2" /> PDF Export</Button>
                            <Button variant="outline" type="button"><Send className="w-4 h-4 mr-2" /> Email Customer</Button>
                            <Button type="submit" className="bg-blue-600 hover:bg-blue-700"><Save className="w-4 h-4 mr-2" /> Save Draft</Button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                        {/* Main Canvas - Left 2/3 */}
                        <div className="lg:col-span-2 space-y-6">

                            {/* Client & Metadata Card */}
                            <Card>
                                <CardHeader className="pb-4">
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <Receipt className="w-5 h-5 text-slate-500" /> Invoice Details
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <FormField control={form.control} name="customerName" render={({ field }) => (
                                            <FormItem><Label>Customer / Billing Name</Label><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                        )} />
                                        <FormField control={form.control} name="vehicleDetails" render={({ field }) => (
                                            <FormItem><Label>Vehicle Reference</Label><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                        )} />
                                    </div>

                                    <div className="grid grid-cols-3 gap-4">
                                        <FormField control={form.control} name="invoiceNumber" render={({ field }) => (
                                            <FormItem><Label>Invoice #</Label><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                        )} />
                                        <FormField control={form.control} name="issueDate" render={({ field }) => (
                                            <FormItem><Label>Issue Date</Label><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                                        )} />
                                        <FormField control={form.control} name="dueDate" render={({ field }) => (
                                            <FormItem><Label>Due Date</Label><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                                        )} />
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Line Items Card */}
                            <Card>
                                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                                    <CardTitle className="text-lg">Line Items</CardTitle>
                                    <Button type="button" size="sm" variant="outline" onClick={() => append({ description: "", quantity: 1, unitPrice: 0, taxRate: 15 })}>
                                        <Plus className="w-4 h-4 mr-2" /> Add Item
                                    </Button>
                                </CardHeader>
                                <CardContent className="px-0 sm:px-6">
                                    <div className="overflow-x-auto">
                                        <Table>
                                            <TableHeader className="bg-slate-50">
                                                <TableRow>
                                                    <TableHead className="w-[40%]">Description</TableHead>
                                                    <TableHead className="w-[15%]">Qty / Hrs</TableHead>
                                                    <TableHead className="w-[15%]">Unit Price</TableHead>
                                                    <TableHead className="w-[15%]">Tax (%)</TableHead>
                                                    <TableHead className="w-[10%] text-right">Total</TableHead>
                                                    <TableHead className="w-[5%]"></TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {fields.map((field, index) => {
                                                    // Calculate row total dynamically
                                                    const rowQty = Number(watchLineItems?.[index]?.quantity || 0);
                                                    const rowPrice = Number(watchLineItems?.[index]?.unitPrice || 0);
                                                    const rowTotal = rowQty * rowPrice;

                                                    return (
                                                        <TableRow key={field.id} className="group">
                                                            <TableCell className="p-2">
                                                                <FormField control={form.control} name={`lineItems.${index}.description`} render={({ field }) => (
                                                                    <FormItem><FormControl><Input {...field} className="h-8" /></FormControl></FormItem>
                                                                )} />
                                                            </TableCell>
                                                            <TableCell className="p-2">
                                                                <FormField control={form.control} name={`lineItems.${index}.quantity`} render={({ field }) => (
                                                                    <FormItem><FormControl><Input type="number" step="0.01" {...field} className="h-8" /></FormControl></FormItem>
                                                                )} />
                                                            </TableCell>
                                                            <TableCell className="p-2">
                                                                <FormField control={form.control} name={`lineItems.${index}.unitPrice`} render={({ field }) => (
                                                                    <FormItem><FormControl><Input type="number" step="0.01" {...field} className="h-8" /></FormControl></FormItem>
                                                                )} />
                                                            </TableCell>
                                                            <TableCell className="p-2">
                                                                <FormField control={form.control} name={`lineItems.${index}.taxRate`} render={({ field }) => (
                                                                    <FormItem><FormControl><Input type="number" step="0.01" {...field} className="h-8" /></FormControl></FormItem>
                                                                )} />
                                                            </TableCell>
                                                            <TableCell className="text-right p-2 font-medium">
                                                                ${rowTotal.toFixed(2)}
                                                            </TableCell>
                                                            <TableCell className="p-2 text-right">
                                                                <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} className="h-8 w-8 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    <Trash2 className="w-4 h-4" />
                                                                </Button>
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })}
                                            </TableBody>
                                        </Table>
                                    </div>
                                    {fields.length === 0 && (
                                        <div className="text-center py-6 text-slate-500 text-sm border-t border-b border-dashed my-4 mx-6">
                                            No line items listed. Click 'Add Item' to begin.
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                        </div>

                        {/* Sidebar Canvas - Right 1/3 */}
                        <div className="space-y-6 lg:self-start sticky top-6">

                            {/* Financial Totals */}
                            <Card className="bg-slate-900 border-slate-800 text-white shadow-xl">
                                <CardHeader className="pb-4">
                                    <CardTitle className="text-lg text-slate-200">Financial Summary</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="space-y-2 text-sm text-slate-300">
                                        <div className="flex justify-between">
                                            <span>Subtotal (Excl. Tax)</span>
                                            <span>${totals.subtotal.toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Dynamic Tax ({watchLineItems?.[0]?.taxRate || 0}%)</span>
                                            <span>${totals.totalTax.toFixed(2)}</span>
                                        </div>
                                    </div>
                                    <div className="border-t border-slate-700 pt-4 flex justify-between font-bold text-white text-2xl">
                                        <span>Amount Due</span>
                                        <span>${totals.totalAmount.toFixed(2)}</span>
                                    </div>
                                </CardContent>
                                <CardFooter className="bg-slate-800/50 pt-4 rounded-b-xl border-t border-slate-700">
                                    <FormField control={form.control} name="status" render={({ field }) => (
                                        <FormItem className="w-full">
                                            <Label className="text-slate-400">Ledger Status</Label>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger className="bg-slate-900 border-slate-700 text-white">
                                                        <SelectValue placeholder="Select status" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent className="bg-slate-800 text-white border-slate-700">
                                                    <SelectItem value="DRAFT">Draft</SelectItem>
                                                    <SelectItem value="SENT">Sent to Customer</SelectItem>
                                                    <SelectItem value="PAID">Paid in Full</SelectItem>
                                                    <SelectItem value="VOID">Voided</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                </CardFooter>
                            </Card>

                            {/* Notes & Terms */}
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm">Footer Notes & Terms</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <FormField control={form.control} name="notes" render={({ field }) => (
                                        <FormItem>
                                            <Label className="text-xs">Customer Message</Label>
                                            <FormControl>
                                                <Textarea {...field} className="text-sm min-h-[80px]" />
                                            </FormControl>
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="terms" render={({ field }) => (
                                        <FormItem>
                                            <Label className="text-xs">Payment Terms</Label>
                                            <FormControl>
                                                <Textarea {...field} className="text-sm min-h-[80px]" />
                                            </FormControl>
                                        </FormItem>
                                    )} />
                                </CardContent>
                            </Card>
                        </div>

                    </div>
                </form>
            </Form>
        </div>
    );
}
