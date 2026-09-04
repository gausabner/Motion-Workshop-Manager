"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const taxFormSchema = z.object({
    taxName: z.string().min(2),
    salesTaxRate: z.coerce.number().min(0).max(100),
    purchasesTaxRate: z.coerce.number().min(0).max(100),
    defaultTaxGroup: z.string(),
    priceIncludesTax: z.string(),
    roundTotal: z.string(),
    multipleTaxes: z.string(),
});

type TaxFormValues = z.infer<typeof taxFormSchema>;

const defaultValues: Partial<TaxFormValues> = {
    taxName: "GST",
    salesTaxRate: 15.0,
    purchasesTaxRate: 15.0,
    defaultTaxGroup: "standard",
    priceIncludesTax: "1",
    roundTotal: "1",
    multipleTaxes: "0",
};

export function TaxSettingsForm() {
    const form = useForm<z.input<typeof taxFormSchema>, unknown, TaxFormValues>({
        resolver: zodResolver(taxFormSchema),
        defaultValues,
    });

    function onSubmit(data: TaxFormValues) {
        console.log("Tax configuration updated:", data);
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Tax & Financial Configurations</CardTitle>
                <CardDescription>
                    Crucial settings defining how invoices calculate totals and manage multi-layer tax requirements.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                            <FormField
                                control={form.control}
                                name="taxName"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Primary Tax Name</FormLabel>
                                        <FormControl>
                                            <Input placeholder="e.g. GST, VAT" {...field} />
                                        </FormControl>
                                        <FormDescription>
                                            This text appears on the printed invoice.
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="defaultTaxGroup"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Default Tax Strategy</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select strategy" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="standard">Standard Single Tax</SelectItem>
                                                <SelectItem value="exempt">Tax Exempt Default</SelectItem>
                                                <SelectItem value="complex">Complex / Multi-layer</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="salesTaxRate"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Sales Tax Rate (%)</FormLabel>
                                        <FormControl>
                                            <Input type="number" step="0.01" {...field} value={field.value as string | number} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="purchasesTaxRate"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Purchases Tax Rate (%)</FormLabel>
                                        <FormControl>
                                            <Input type="number" step="0.01" {...field} value={field.value as string | number} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="priceIncludesTax"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Prices Include Tax</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select behavior" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="1">Yes (Inclusive Pricing)</SelectItem>
                                                <SelectItem value="0">No (Exclusive, Added at Checkout)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="multipleTaxes"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Enable Multiple Tax Layers</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select behavior" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="1">Yes (e.g. State & Federal combinations)</SelectItem>
                                                <SelectItem value="0">No</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                        </div>
                        <div className="flex justify-end pt-4 border-t">
                            <Button type="submit">Update financial settings</Button>
                        </div>
                    </form>
                </Form>
            </CardContent>
        </Card>
    );
}
