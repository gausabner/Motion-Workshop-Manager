"use client";

import { useState, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import {
    Settings,
    User,
    Car,
    Calendar,
    DollarSign,
    FileText,
    List,
    Type,
    Shield,
    ChevronDown,
    ChevronUp,
    X
} from "lucide-react";
import { PillToggle } from "@/components/ui/pill-toggle";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

const companyFormSchema = z.object({
    businessNumber: z.string().optional(),
    timezone: z.string(),
    useMemberNumbers: z.boolean(),
    enable2FA: z.boolean(),
    requireSSO: z.boolean(),

    // Product Settings
    defaultLabourProduct: z.string().optional(),
    costTypeForProducts: z.string(),
    reservedStock: z.boolean(),
    incOnOrderQty: z.boolean(),
    flatRate: z.boolean(),

    // Vehicle Settings
    vehicleGroups: z.array(z.string()),
    defaultServiceInterval: z.string().optional(),
    defaultMethodOfContact: z.string().optional(),
    advancedVehicleFields: z.boolean(),
    showFleetCode: z.boolean(),

    // Booking Settings
    shopOpens: z.string().optional(),
    shopCloses: z.string().optional(),
    showAllShopForMonth: z.boolean(),
    descriptionToJobStatusComment: z.boolean(),
    mechanicsForBookingDiary: z.string().optional(),
    defaultWorkHoursPerDay: z.string().optional(),

    // Tax Settings
    taxName: z.string().optional(),
    purchasesTaxRate: z.string().optional(),
    salesTaxRate: z.string().optional(),
    pricesIncludeTax: z.boolean(),
    taxFreight: z.boolean(),
    roundTotal: z.boolean(),
    multipleTaxes: z.boolean(),
    discountIncludesTax: z.boolean(),

    // Invoice Settings
    invoiceFormat: z.string().optional(),
    invoiceTerms: z.string().optional(),
    bundledItemPrintStyle: z.string().optional(),
    hidePartNumbers: z.boolean(),
    hideLabourQuantity: z.boolean(),
    hideLinePrices: z.boolean(),
    hideHeaderFooterOnBundles: z.boolean(),
    barcodeOnJobCard: z.boolean(),
    invoiceNumberEqualsJobNumber: z.boolean(),
    cannotProcessOrdersAttached: z.boolean(),
    addPricingToJobCard: z.boolean(),
    hideTyreDetailsJobCard: z.boolean(),
    mergeBundleWithInvoiceLines: z.boolean(),
    hoursWorkedField: z.boolean(),
    hideTaxOnInvoiceLines: z.boolean(),
    preventSplitNotesOnInvoice: z.boolean(),
    askForDueDatesOnProcessInvoice: z.boolean(),
    useTodayAsInvoicePostDate: z.boolean(),
    useServiceAdvisors: z.boolean(),

    // Next Invoice / Payment Number
    nextInvoiceNumber: z.string().optional(),
    nextCreditNumber: z.string().optional(),
    nextPONumber: z.string().optional(),
    nextReceiptNumber: z.string().optional(),
    nextSupplierPaymentNumber: z.string().optional(),

    // Variable Labels
    plateNumberField: z.string().optional(),
    vinField: z.string().optional(),
    fleetCodeField: z.string().optional(),
    employeeTitleName: z.string().optional(),

    // Dealer Access
    dealerAccessCode: z.string().optional()
});

type CompanyFormValues = z.infer<typeof companyFormSchema>;

const defaultValues: Partial<CompanyFormValues> = {
    businessNumber: "",
    timezone: "South Africa - Pretoria (+02:00)",
    useMemberNumbers: false,
    enable2FA: false,
    requireSSO: false,

    defaultLabourProduct: "",
    costTypeForProducts: "Current Cost (Default)",
    reservedStock: false,
    incOnOrderQty: true,
    flatRate: false,

    vehicleGroups: [
        "Light Commercial",
        "Machinery",
        "Marine",
        "Motorcycle",
        "Recreational Vehicles",
        "Standard System Types",
        "Trailers",
        "Trucks / Articulated"
    ],
    defaultServiceInterval: "6",
    defaultMethodOfContact: "SMS",
    advancedVehicleFields: false,
    showFleetCode: false,

    shopOpens: "7:30 AM",
    shopCloses: "4:30 PM",
    showAllShopForMonth: false,
    descriptionToJobStatusComment: false,
    mechanicsForBookingDiary: "8",
    defaultWorkHoursPerDay: "40",

    taxName: "Sales Tax",
    purchasesTaxRate: "15",
    salesTaxRate: "15",
    pricesIncludeTax: false,
    taxFreight: true,
    roundTotal: false,
    multipleTaxes: false,
    discountIncludesTax: true,

    invoiceFormat: "Default (B&W)",
    invoiceTerms: "",
    bundledItemPrintStyle: "",
    hidePartNumbers: false,
    hideLabourQuantity: true,
    hideLinePrices: false,
    hideHeaderFooterOnBundles: false,
    barcodeOnJobCard: true,
    invoiceNumberEqualsJobNumber: false,
    cannotProcessOrdersAttached: false,
    addPricingToJobCard: false,
    hideTyreDetailsJobCard: false,
    mergeBundleWithInvoiceLines: false,
    hoursWorkedField: true,
    hideTaxOnInvoiceLines: false,
    preventSplitNotesOnInvoice: false,
    askForDueDatesOnProcessInvoice: true,
    useTodayAsInvoicePostDate: false,
    useServiceAdvisors: false,

    nextInvoiceNumber: "50000",
    nextCreditNumber: "10000",
    nextPONumber: "20000",
    nextReceiptNumber: "30000",
    nextSupplierPaymentNumber: "40000",

    plateNumberField: "",
    vinField: "",
    fleetCodeField: "",
    employeeTitleName: "Mechanic",

    dealerAccessCode: ""
};

export function CompanySettingsForm() {
    // Client-side hydration safety
    const [isMounted, setIsMounted] = useState(false);

    // UI Expand State (all true by default for better visibility)
    const [openCompany, setOpenCompany] = useState(true);
    const [openProduct, setOpenProduct] = useState(true);
    const [openVehicle, setOpenVehicle] = useState(true);
    const [openBooking, setOpenBooking] = useState(true);
    const [openTax, setOpenTax] = useState(true);
    const [openInvoice, setOpenInvoice] = useState(true);
    const [openCounters, setOpenCounters] = useState(true);
    const [openLabels, setOpenLabels] = useState(true);
    const [openDealer, setOpenDealer] = useState(true);

    const form = useForm<CompanyFormValues>({
        resolver: zodResolver(companyFormSchema),
        defaultValues,
    });

    useEffect(() => {
        setIsMounted(true);
    }, []);

    if (!isMounted) {
        return <div className="min-h-screen" />; // Prevent SSR hydration mismatch
    }

    function onSubmit(data: CompanyFormValues) {
        console.log("Settings Update Submitted:", data);
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-7xl mx-auto pb-24">

                {/* 1. Company Settings Block */}
                <div className="border border-slate-300 rounded-sm overflow-hidden bg-white shadow-sm">
                    <div
                        onClick={() => setOpenCompany(!openCompany)}
                        className="bg-[#e6e6e6] px-4 py-3 flex items-center justify-between cursor-pointer border-b border-slate-300"
                    >
                        <div className="flex items-center gap-2 text-slate-700 font-bold">
                            <Settings className="w-5 h-5 text-slate-500 fill-slate-500" />
                            <span className="text-sm">Company Settings</span>
                        </div>
                        {openCompany ? <ChevronUp className="w-4 h-4 text-slate-500 stroke-[3]" /> : <ChevronDown className="w-4 h-4 text-slate-500 stroke-[3]" />}
                    </div>

                    {openCompany && (
                        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-8">
                            <FormField control={form.control} name="businessNumber" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs text-slate-500 mb-1 font-normal">Business Number</FormLabel>
                                    <FormControl>
                                        <Input className="bg-[#f5f5f5] border-none text-sm h-9 shadow-sm" {...field} />
                                    </FormControl>
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="timezone" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs text-slate-500 mb-1 font-normal">Time Zone</FormLabel>
                                    <FormControl>
                                        <select className="flex h-9 w-full rounded-sm bg-[#f5f5f5] px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 text-slate-600 border-none" {...field}>
                                            <option value="South Africa - Pretoria (+02:00)">South Africa - Pretoria (+02:00)</option>
                                            <option value="UTC (00:00)">UTC (00:00)</option>
                                        </select>
                                    </FormControl>
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="useMemberNumbers" render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel className="text-xs text-slate-500 mb-2 font-normal">Use Member Numbers</FormLabel>
                                    <FormControl>
                                        <div><PillToggle checked={field.value} onChange={field.onChange} /></div>
                                    </FormControl>
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="enable2FA" render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel className="text-xs text-slate-500 mb-2 font-normal">Enable 2FA</FormLabel>
                                    <FormControl>
                                        <div><PillToggle checked={field.value} onChange={field.onChange} /></div>
                                    </FormControl>
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="requireSSO" render={({ field }) => (
                                <FormItem className="flex flex-col md:col-start-1">
                                    <FormLabel className="text-xs text-slate-500 mb-2 font-normal">Require SSO</FormLabel>
                                    <FormControl>
                                        <div><PillToggle checked={field.value} onChange={field.onChange} /></div>
                                    </FormControl>
                                </FormItem>
                            )} />
                        </div>
                    )}
                </div>

                {/* 2. Product Settings Block */}
                <div className="border border-slate-300 rounded-sm overflow-hidden bg-white shadow-sm">
                    <div
                        onClick={() => setOpenProduct(!openProduct)}
                        className="bg-[#e6e6e6] px-4 py-3 flex items-center justify-between cursor-pointer border-b border-slate-300"
                    >
                        <div className="flex items-center gap-2 text-slate-700 font-bold">
                            <User className="w-5 h-5 text-slate-500 fill-slate-500" />
                            <span className="text-sm">Product Settings</span>
                        </div>
                        {openProduct ? <ChevronUp className="w-4 h-4 text-slate-500 stroke-[3]" /> : <ChevronDown className="w-4 h-4 text-slate-500 stroke-[3]" />}
                    </div>

                    {openProduct && (
                        <div className="p-6 grid grid-cols-1 md:grid-cols-4 gap-x-8 gap-y-6">
                            <FormField control={form.control} name="defaultLabourProduct" render={({ field }) => (
                                <FormItem className="col-span-1 md:col-span-2">
                                    <FormLabel className="text-xs text-slate-500 mb-1 font-normal">Default Labour Product</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Search Products..." className="bg-[#f5f5f5] border-none text-sm h-9 shadow-sm placeholder:text-slate-400" {...field} />
                                    </FormControl>
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="costTypeForProducts" render={({ field }) => (
                                <FormItem className="col-span-1 md:col-span-2">
                                    <FormLabel className="text-xs text-slate-500 mb-1 font-normal">Cost Type For Products</FormLabel>
                                    <FormControl>
                                        <select className="flex h-9 w-full rounded-sm bg-[#f5f5f5] px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 text-slate-600 border-none" {...field}>
                                            <option value="Current Cost (Default)">Current Cost (Default)</option>
                                            <option value="Average Cost">Average Cost</option>
                                        </select>
                                    </FormControl>
                                </FormItem>
                            )} />

                            <FormField control={form.control} name="reservedStock" render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel className="text-xs text-slate-500 mb-2 font-normal">Reserved Stock</FormLabel>
                                    <FormControl>
                                        <div><PillToggle checked={field.value} onChange={field.onChange} /></div>
                                    </FormControl>
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="incOnOrderQty" render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel className="text-xs text-slate-500 mb-2 font-normal">Inc On Order Qty</FormLabel>
                                    <FormControl>
                                        <div><PillToggle checked={field.value} onChange={field.onChange} /></div>
                                    </FormControl>
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="flatRate" render={({ field }) => (
                                <FormItem className="flex flex-col md:col-start-3">
                                    <FormLabel className="text-xs text-slate-500 mb-2 font-normal">Flat Rate</FormLabel>
                                    <FormControl>
                                        <div><PillToggle checked={field.value} onChange={field.onChange} /></div>
                                    </FormControl>
                                </FormItem>
                            )} />
                        </div>
                    )}
                </div>

                {/* 3. Vehicle Settings Block */}
                <div className="border border-slate-300 rounded-sm overflow-hidden bg-white shadow-sm">
                    <div
                        onClick={() => setOpenVehicle(!openVehicle)}
                        className="bg-[#e6e6e6] px-4 py-3 flex items-center justify-between cursor-pointer border-b border-slate-300"
                    >
                        <div className="flex items-center gap-2 text-slate-700 font-bold">
                            <User className="w-5 h-5 text-slate-500 fill-slate-500" />
                            <span className="text-sm">Vehicle Settings</span>
                        </div>
                        {openVehicle ? <ChevronUp className="w-4 h-4 text-slate-500 stroke-[3]" /> : <ChevronDown className="w-4 h-4 text-slate-500 stroke-[3]" />}
                    </div>

                    {openVehicle && (
                        <div className="p-6 flex flex-col gap-6">
                            <FormField control={form.control} name="vehicleGroups" render={({ field }) => {
                                const removeGroup = (group: string) => {
                                    field.onChange(field.value.filter(g => g !== group));
                                };

                                return (
                                    <FormItem>
                                        <FormLabel className="text-xs text-slate-500 mb-1 font-normal">Vehicle Groups</FormLabel>
                                        <div className="border border-slate-300 rounded-sm p-1.5 min-h-[42px] bg-white flex flex-wrap gap-1.5 shadow-sm items-center">
                                            {field.value.map(group => (
                                                <div key={group} className="flex items-center gap-1 bg-[#fcfcfc] border border-slate-200 px-2 py-0.5 rounded-[3px] text-xs text-slate-600 shadow-sm">
                                                    <span>{group}</span>
                                                    <X
                                                        className="w-3 h-3 hover:text-slate-800 cursor-pointer text-slate-400 font-bold ml-1"
                                                        onClick={() => removeGroup(group)}
                                                    />
                                                </div>
                                            ))}
                                            <input
                                                className="flex-1 min-w-[120px] outline-none text-sm px-2 text-slate-600 bg-transparent placeholder-slate-400 h-6"
                                                placeholder={field.value.length === 0 ? "Select Some Options" : ""}
                                            />
                                        </div>
                                    </FormItem>
                                );
                            }} />

                            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                                <FormField control={form.control} name="defaultServiceInterval" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xs text-slate-500 mb-1 font-normal">Default Service Interval</FormLabel>
                                        <FormControl>
                                            <Input className="bg-[#f5f5f5] border-none text-sm h-9 shadow-sm" {...field} />
                                        </FormControl>
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="defaultMethodOfContact" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xs text-slate-500 mb-1 font-normal">Default Method Of Contact</FormLabel>
                                        <FormControl>
                                            <select className="flex h-9 w-full rounded-sm bg-[#f5f5f5] px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 text-slate-600 border-none" {...field}>
                                                <option value="SMS">SMS</option>
                                                <option value="Email">Email</option>
                                            </select>
                                        </FormControl>
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="advancedVehicleFields" render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel className="text-xs text-slate-500 mb-2 font-normal">Advanced Vehicle Fields</FormLabel>
                                        <FormControl>
                                            <div><PillToggle checked={field.value} onChange={field.onChange} /></div>
                                        </FormControl>
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="showFleetCode" render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel className="text-xs text-slate-500 mb-2 font-normal">Show Fleet Code</FormLabel>
                                        <FormControl>
                                            <div><PillToggle checked={field.value} onChange={field.onChange} /></div>
                                        </FormControl>
                                    </FormItem>
                                )} />
                            </div>
                        </div>
                    )}
                </div>

                {/* 4. Booking Settings Block */}
                <div className="border border-slate-300 rounded-sm overflow-hidden bg-white shadow-sm">
                    <div
                        onClick={() => setOpenBooking(!openBooking)}
                        className="bg-[#e6e6e6] px-4 py-3 flex items-center justify-between cursor-pointer border-b border-slate-300"
                    >
                        <div className="flex items-center gap-2 text-slate-700 font-bold">
                            <User className="w-5 h-5 text-slate-500 fill-slate-500" />
                            <span className="text-sm">Booking Settings</span>
                        </div>
                        {openBooking ? <ChevronUp className="w-4 h-4 text-slate-500 stroke-[3]" /> : <ChevronDown className="w-4 h-4 text-slate-500 stroke-[3]" />}
                    </div>
                    {openBooking && (
                        <div className="p-6 grid grid-cols-1 md:grid-cols-4 gap-8">
                            <FormField control={form.control} name="shopOpens" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs text-slate-500 mb-1 font-normal">Shop Opens</FormLabel>
                                    <FormControl>
                                        <Input className="bg-[#f5f5f5] border-none text-sm h-9 shadow-sm" {...field} />
                                    </FormControl>
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="shopCloses" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs text-slate-500 mb-1 font-normal">Shop Closes</FormLabel>
                                    <FormControl>
                                        <Input className="bg-[#f5f5f5] border-none text-sm h-9 shadow-sm" {...field} />
                                    </FormControl>
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="showAllShopForMonth" render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel className="text-xs text-slate-500 mb-2 font-normal">Show All Shop For Month</FormLabel>
                                    <FormControl>
                                        <div><PillToggle checked={field.value} onChange={field.onChange} /></div>
                                    </FormControl>
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="descriptionToJobStatusComment" render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel className="text-xs text-slate-500 mb-2 font-normal">Description To Job Status Comment</FormLabel>
                                    <FormControl>
                                        <div><PillToggle checked={field.value} onChange={field.onChange} /></div>
                                    </FormControl>
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="mechanicsForBookingDiary" render={({ field }) => (
                                <FormItem className="col-start-3">
                                    <FormLabel className="text-xs text-slate-500 mb-1 font-normal">Mechanics For Booking Diary</FormLabel>
                                    <FormControl>
                                        <Input className="bg-[#f5f5f5] border-none text-sm h-9 shadow-sm" {...field} />
                                    </FormControl>
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="defaultWorkHoursPerDay" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs text-slate-500 mb-1 font-normal">Default Work Hours Per Day</FormLabel>
                                    <FormControl>
                                        <Input className="bg-[#f5f5f5] border-none text-sm h-9 shadow-sm" {...field} />
                                    </FormControl>
                                </FormItem>
                            )} />
                        </div>
                    )}
                </div>

                {/* 5. Tax Settings Block */}
                <div className="border border-slate-300 rounded-sm overflow-hidden bg-white shadow-sm">
                    <div
                        onClick={() => setOpenTax(!openTax)}
                        className="bg-[#e6e6e6] px-4 py-3 flex items-center justify-between cursor-pointer border-b border-slate-300"
                    >
                        <div className="flex items-center gap-2 text-slate-700 font-bold">
                            <DollarSign className="w-5 h-5 text-slate-500" strokeWidth={3} />
                            <span className="text-sm">Tax Settings</span>
                        </div>
                        {openTax ? <ChevronUp className="w-4 h-4 text-slate-500 stroke-[3]" /> : <ChevronDown className="w-4 h-4 text-slate-500 stroke-[3]" />}
                    </div>
                    {openTax && (
                        <div className="p-6 grid grid-cols-1 md:grid-cols-4 gap-8">
                            <FormField control={form.control} name="taxName" render={({ field }) => (
                                <FormItem className="col-span-2">
                                    <FormLabel className="text-xs text-slate-500 mb-1 font-normal">Tax Name</FormLabel>
                                    <FormControl>
                                        <Input className="bg-[#f5f5f5] border-none text-sm h-9 shadow-sm" {...field} />
                                    </FormControl>
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="purchasesTaxRate" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs text-slate-500 mb-1 font-normal">Purchases Tax Rate</FormLabel>
                                    <FormControl>
                                        <div className="relative">
                                            <Input className="bg-[#f5f5f5] border-none text-sm h-9 shadow-sm pr-8" {...field} />
                                            <span className="absolute right-3 top-[8px] text-xs font-bold text-slate-500">%</span>
                                        </div>
                                    </FormControl>
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="salesTaxRate" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs text-slate-500 mb-1 font-normal">Sales Tax Rate</FormLabel>
                                    <FormControl>
                                        <div className="relative">
                                            <Input className="bg-[#f5f5f5] border-none text-sm h-9 shadow-sm pr-8" {...field} />
                                            <span className="absolute right-3 top-[8px] text-xs font-bold text-slate-500">%</span>
                                        </div>
                                    </FormControl>
                                </FormItem>
                            )} />

                            {/* Toggles */}
                            <FormField control={form.control} name="pricesIncludeTax" render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel className="text-xs text-slate-500 mb-2 font-normal">Prices Include Tax</FormLabel>
                                    <FormControl>
                                        <div><PillToggle checked={field.value} onChange={field.onChange} /></div>
                                    </FormControl>
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="taxFreight" render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel className="text-xs text-slate-500 mb-2 font-normal">Tax Freight</FormLabel>
                                    <FormControl>
                                        <div><PillToggle checked={field.value} onChange={field.onChange} /></div>
                                    </FormControl>
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="roundTotal" render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel className="text-xs text-slate-500 mb-2 font-normal">Round Total</FormLabel>
                                    <FormControl>
                                        <div><PillToggle checked={field.value} onChange={field.onChange} /></div>
                                    </FormControl>
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="multipleTaxes" render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel className="text-xs text-slate-500 mb-2 font-normal">Multiple Taxes</FormLabel>
                                    <FormControl>
                                        <div><PillToggle checked={field.value} onChange={field.onChange} /></div>
                                    </FormControl>
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="discountIncludesTax" render={({ field }) => (
                                <FormItem className="flex flex-col col-start-1">
                                    <FormLabel className="text-xs text-slate-500 mb-2 font-normal">Discount Includes Tax</FormLabel>
                                    <FormControl>
                                        <div><PillToggle checked={field.value} onChange={field.onChange} /></div>
                                    </FormControl>
                                </FormItem>
                            )} />
                        </div>
                    )}
                </div>

                {/* 6. Invoice Settings Block */}
                <div className="border border-slate-300 rounded-sm overflow-hidden bg-white shadow-sm">
                    <div
                        onClick={() => setOpenInvoice(!openInvoice)}
                        className="bg-[#e6e6e6] px-4 py-3 flex items-center justify-between cursor-pointer border-b border-slate-300"
                    >
                        <div className="flex items-center gap-2 text-slate-700 font-bold">
                            <FileText className="w-5 h-5 text-slate-500 fill-slate-500" />
                            <span className="text-sm">Invoice Settings</span>
                        </div>
                        {openInvoice ? <ChevronUp className="w-4 h-4 text-slate-500 stroke-[3]" /> : <ChevronDown className="w-4 h-4 text-slate-500 stroke-[3]" />}
                    </div>
                    {openInvoice && (
                        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-8">
                            <FormField control={form.control} name="invoiceFormat" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs text-slate-500 mb-1 font-normal">Invoice Format</FormLabel>
                                    <FormControl>
                                        <select className="flex h-9 w-full rounded-sm bg-[#f5f5f5] px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 text-slate-600 border-none" {...field}>
                                            <option value="Default (B&W)">Default (B&W)</option>
                                        </select>
                                    </FormControl>
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="invoiceTerms" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs text-slate-500 mb-1 font-normal">Invoice Terms</FormLabel>
                                    <FormControl>
                                        <select className="flex h-9 w-full rounded-sm bg-[#f5f5f5] px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none text-slate-400 border-none" {...field}>
                                            <option value="">Choose a default payment term</option>
                                        </select>
                                    </FormControl>
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="bundledItemPrintStyle" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs text-slate-500 mb-1 font-normal">Bundled Item Print Style</FormLabel>
                                    <FormControl>
                                        <select className="flex h-9 w-full rounded-sm bg-[#f5f5f5] px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none text-slate-400 border-none" {...field}>
                                            <option value="">Choose a print style</option>
                                        </select>
                                    </FormControl>
                                </FormItem>
                            )} />

                            {/* Invoices Toggles Column 1 */}
                            <div className="flex flex-col gap-6">
                                <FormField control={form.control} name="hidePartNumbers" render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel className="text-xs text-slate-500 mb-2 font-normal">Hide Part Numbers</FormLabel>
                                        <FormControl><div><PillToggle checked={field.value} onChange={field.onChange} /></div></FormControl>
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="hideHeaderFooterOnBundles" render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel className="text-xs text-slate-500 mb-2 font-normal">Hide Header/Footer On Bundles</FormLabel>
                                        <FormControl><div><PillToggle checked={field.value} onChange={field.onChange} /></div></FormControl>
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="cannotProcessOrdersAttached" render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel className="text-xs text-slate-500 mb-2 font-normal">Cannot Process - Orders Attached</FormLabel>
                                        <FormControl><div><PillToggle checked={field.value} onChange={field.onChange} /></div></FormControl>
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="mergeBundleWithInvoiceLines" render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel className="text-xs text-slate-500 mb-2 font-normal">Merge Bundle With Invoice Lines</FormLabel>
                                        <FormControl><div><PillToggle checked={field.value} onChange={field.onChange} /></div></FormControl>
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="preventSplitNotesOnInvoice" render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel className="text-xs text-slate-500 mb-2 font-normal">Prevent Split Notes On Invoice</FormLabel>
                                        <FormControl><div><PillToggle checked={field.value} onChange={field.onChange} /></div></FormControl>
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="useServiceAdvisors" render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel className="text-xs text-slate-500 mb-2 font-normal">Use Service Advisors</FormLabel>
                                        <FormControl><div><PillToggle checked={field.value} onChange={field.onChange} /></div></FormControl>
                                    </FormItem>
                                )} />
                            </div>

                            {/* Invoices Toggles Column 2 */}
                            <div className="flex flex-col gap-6">
                                <FormField control={form.control} name="hideLabourQuantity" render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel className="text-xs text-slate-500 mb-2 font-normal">Hide Labour Quantity</FormLabel>
                                        <FormControl><div><PillToggle checked={field.value} onChange={field.onChange} /></div></FormControl>
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="barcodeOnJobCard" render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel className="text-xs text-slate-500 mb-2 font-normal">Barcode On Job Card</FormLabel>
                                        <FormControl><div><PillToggle checked={field.value} onChange={field.onChange} /></div></FormControl>
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="addPricingToJobCard" render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel className="text-xs text-slate-500 mb-2 font-normal">Add pricing To Job Card</FormLabel>
                                        <FormControl><div><PillToggle checked={field.value} onChange={field.onChange} /></div></FormControl>
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="hoursWorkedField" render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel className="text-xs text-slate-500 mb-2 font-normal">Hours Worked Field</FormLabel>
                                        <FormControl><div><PillToggle checked={field.value} onChange={field.onChange} /></div></FormControl>
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="askForDueDatesOnProcessInvoice" render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel className="text-xs text-slate-500 mb-2 font-normal">Ask For Due Dates On Process Invoice</FormLabel>
                                        <FormControl><div><PillToggle checked={field.value} onChange={field.onChange} /></div></FormControl>
                                    </FormItem>
                                )} />
                            </div>

                            {/* Invoices Toggles Column 3 */}
                            <div className="flex flex-col gap-6">
                                <FormField control={form.control} name="hideLinePrices" render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel className="text-xs text-slate-500 mb-2 font-normal">Hide Line Prices</FormLabel>
                                        <FormControl><div><PillToggle checked={field.value} onChange={field.onChange} /></div></FormControl>
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="invoiceNumberEqualsJobNumber" render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel className="text-xs text-slate-500 mb-2 font-normal">Invoice Number Equals Job Number</FormLabel>
                                        <FormControl><div><PillToggle checked={field.value} onChange={field.onChange} /></div></FormControl>
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="hideTyreDetailsJobCard" render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel className="text-xs text-slate-500 mb-2 font-normal">Hide Tyre Details (Job Card)</FormLabel>
                                        <FormControl><div><PillToggle checked={field.value} onChange={field.onChange} /></div></FormControl>
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="hideTaxOnInvoiceLines" render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel className="text-xs text-slate-500 mb-2 font-normal">Hide Tax On Invoice Lines</FormLabel>
                                        <FormControl><div><PillToggle checked={field.value} onChange={field.onChange} /></div></FormControl>
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="useTodayAsInvoicePostDate" render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel className="text-xs text-slate-500 mb-2 font-normal">Use Today As Invoice Post Date</FormLabel>
                                        <FormControl><div><PillToggle checked={field.value} onChange={field.onChange} /></div></FormControl>
                                    </FormItem>
                                )} />
                            </div>
                        </div>
                    )}
                </div>

                {/* 7. Next Invoice / Payment Number Block */}
                <div className="border border-slate-300 rounded-sm overflow-hidden bg-white shadow-sm">
                    <div
                        onClick={() => setOpenCounters(!openCounters)}
                        className="bg-[#e6e6e6] px-4 py-3 flex items-center justify-between cursor-pointer border-b border-slate-300"
                    >
                        <div className="flex items-center gap-2 text-slate-700 font-bold">
                            <List className="w-5 h-5 text-slate-500" strokeWidth={3} />
                            <span className="text-sm">Next Invoice / Payment Number</span>
                        </div>
                        {openCounters ? <ChevronUp className="w-4 h-4 text-slate-500 stroke-[3]" /> : <ChevronDown className="w-4 h-4 text-slate-500 stroke-[3]" />}
                    </div>
                    {openCounters && (
                        <div className="p-6 grid grid-cols-1 md:grid-cols-4 gap-8">
                            <FormField control={form.control} name="nextInvoiceNumber" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs text-slate-500 mb-1 font-normal">Invoice Number</FormLabel>
                                    <FormControl>
                                        <Input className="bg-[#f5f5f5] border-none text-sm h-9 shadow-sm" {...field} />
                                    </FormControl>
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="nextCreditNumber" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs text-slate-500 mb-1 font-normal">Credit Number</FormLabel>
                                    <FormControl>
                                        <Input className="bg-[#f5f5f5] border-none text-sm h-9 shadow-sm" {...field} />
                                    </FormControl>
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="nextPONumber" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs text-slate-500 mb-1 font-normal">PO Number</FormLabel>
                                    <FormControl>
                                        <Input className="bg-[#f5f5f5] border-none text-sm h-9 shadow-sm" {...field} />
                                    </FormControl>
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="nextReceiptNumber" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs text-slate-500 mb-1 font-normal">Receipt Number</FormLabel>
                                    <FormControl>
                                        <Input className="bg-[#f5f5f5] border-none text-sm h-9 shadow-sm" {...field} />
                                    </FormControl>
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="nextSupplierPaymentNumber" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs text-slate-500 mb-1 font-normal">Supplier Payment Number</FormLabel>
                                    <FormControl>
                                        <Input className="bg-[#f5f5f5] border-none text-sm h-9 shadow-sm" {...field} />
                                    </FormControl>
                                </FormItem>
                            )} />
                        </div>
                    )}
                </div>

                {/* 8. Variable Labels Block */}
                <div className="border border-slate-300 rounded-sm overflow-hidden bg-white shadow-sm">
                    <div
                        onClick={() => setOpenLabels(!openLabels)}
                        className="bg-[#e6e6e6] px-4 py-3 flex items-center justify-between cursor-pointer border-b border-slate-300"
                    >
                        <div className="flex items-center gap-2 text-slate-700 font-bold">
                            <List className="w-5 h-5 text-slate-500" strokeWidth={3} />
                            <span className="text-sm">Variable Labels</span>
                        </div>
                        {openLabels ? <ChevronUp className="w-4 h-4 text-slate-500 stroke-[3]" /> : <ChevronDown className="w-4 h-4 text-slate-500 stroke-[3]" />}
                    </div>
                    {openLabels && (
                        <div className="p-6 grid grid-cols-1 md:grid-cols-4 gap-8">
                            <FormField control={form.control} name="plateNumberField" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs text-slate-500 mb-1 font-normal">Plate Number Field</FormLabel>
                                    <FormControl>
                                        <Input className="bg-[#f5f5f5] border-none text-sm h-9 shadow-sm" {...field} />
                                    </FormControl>
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="vinField" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs text-slate-500 mb-1 font-normal">VIN Field</FormLabel>
                                    <FormControl>
                                        <Input className="bg-[#f5f5f5] border-none text-sm h-9 shadow-sm" {...field} />
                                    </FormControl>
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="fleetCodeField" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs text-slate-500 mb-1 font-normal">Fleet Code Field</FormLabel>
                                    <FormControl>
                                        <Input className="bg-[#f5f5f5] border-none text-sm h-9 shadow-sm" {...field} />
                                    </FormControl>
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="employeeTitleName" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs text-slate-500 mb-1 font-normal">Employee Title Name</FormLabel>
                                    <FormControl>
                                        <Input className="bg-[#f5f5f5] border-none text-sm h-9 shadow-sm" {...field} />
                                    </FormControl>
                                </FormItem>
                            )} />
                        </div>
                    )}
                </div>

                {/* 9. Dealer Access Block */}
                <div className="border border-slate-300 rounded-sm overflow-hidden bg-white shadow-sm">
                    <div
                        onClick={() => setOpenDealer(!openDealer)}
                        className="bg-[#e6e6e6] px-4 py-3 flex items-center justify-between cursor-pointer border-b border-slate-300"
                    >
                        <div className="flex items-center gap-2 text-slate-700 font-bold">
                            <User className="w-5 h-5 text-slate-500 fill-slate-500" />
                            <span className="text-sm">Dealer Access</span>
                        </div>
                        {openDealer ? <ChevronUp className="w-4 h-4 text-slate-500 stroke-[3]" /> : <ChevronDown className="w-4 h-4 text-slate-500 stroke-[3]" />}
                    </div>
                    {openDealer && (
                        <div className="p-6">
                            <FormField control={form.control} name="dealerAccessCode" render={({ field }) => (
                                <FormItem className="max-w-[500px]">
                                    <FormLabel className="text-xs text-slate-500 mb-1 font-normal">Code</FormLabel>
                                    <div className="flex items-center gap-4">
                                        <FormControl>
                                            <Input className="bg-[#f5f5f5] border-none text-sm h-9 shadow-sm" {...field} />
                                        </FormControl>
                                        <button
                                            type="button"
                                            className="bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs px-4 h-9 rounded-sm flex-shrink-0 whitespace-nowrap"
                                        >
                                            Grant Access
                                        </button>
                                    </div>
                                </FormItem>
                            )} />
                        </div>
                    )}
                </div>

                {/* Floating Save Button mapped to right */}
                <div className="flex justify-end pt-4 pb-12">
                    <button type="submit" className="bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm px-6 h-10 rounded-sm shadow-sm">
                        Save
                    </button>
                </div>
            </form>
        </Form>
    );
}
