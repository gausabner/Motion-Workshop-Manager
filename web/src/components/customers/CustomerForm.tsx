"use client";

import { User, ExternalLink, ChevronDown, Check, Save, MessageSquare, Mail } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Customer } from "@/types/customer";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface CustomerFormProps {
    initialData?: Customer;
}

export function CustomerForm({ initialData }: CustomerFormProps) {
    const router = useRouter();

    // Status Toggles state (simulating the pills)
    const [isCash, setIsCash] = useState(initialData?.is_cash ?? true);
    const [isIndividual, setIsIndividual] = useState(initialData?.is_individual ?? true);
    const [isNonBiller, setIsNonBiller] = useState(initialData?.is_non_biller ?? true);

    const handleSave = () => {
        // In a real app, this would post to an API
        router.push("/demo-tenant/dashboard/customers");
    };

    return (
        <div className="w-full max-w-7xl mx-auto h-full flex flex-col pb-12">
            <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
                <Card className="rounded-none shadow-none border border-slate-200">
                    {/* Header Section */}
                    <CardHeader className="bg-slate-50 border-b py-3 px-6 flex flex-row items-center justify-between space-y-0 relative">
                        <div className="flex items-center gap-3">
                            <User className="w-6 h-6 text-slate-400" />
                            <CardTitle className="text-xl text-slate-800 font-bold">Customer Details:</CardTitle>
                        </div>

                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-slate-700">Unapplied Credit:</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-slate-700">Account Balance:</span>
                            </div>
                            <div className="flex items-center gap-1 border-l pl-4 border-slate-300">
                                <button type="button" className="p-1 px-2 text-slate-500 hover:text-slate-800 transition-colors">
                                    <ExternalLink className="w-4 h-4" />
                                </button>
                                <button type="button" className="p-1 px-2 text-slate-500 hover:text-slate-800 transition-colors bg-slate-200/50 rounded-sm">
                                    <ChevronDown className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Status Pills aligned bottom right of header area - rendered absolutely for exact mockup mapping or flex col */}
                        <div className="absolute right-6 -bottom-5 flex items-center gap-2">
                            {/* Cash Pill */}
                            <button type="button" onClick={() => setIsCash(!isCash)} className={`flex items-center rounded-full border border-teal-600 text-[10px] font-bold tracking-wider overflow-hidden transition-colors ${isCash ? 'bg-teal-600 text-white' : 'bg-white text-teal-600'}`}>
                                <span className="px-3 py-0.5">CASH</span>
                                <div className={`w-5 h-5 rounded-full border border-teal-600 flex items-center justify-center bg-white ml-0.5 mr-[1px] my-[1px] ${isCash ? 'opacity-100' : 'opacity-0'}`}>
                                </div>
                            </button>
                            {/* Individual Pill */}
                            <button type="button" onClick={() => setIsIndividual(!isIndividual)} className={`flex items-center rounded-full border border-slate-400 text-[10px] font-bold tracking-wider overflow-hidden transition-colors ${isIndividual ? 'bg-slate-400 text-white' : 'bg-white text-slate-400'}`}>
                                <span className="px-3 py-0.5">INDIVIDUAL</span>
                                <div className={`w-5 h-5 rounded-full border border-slate-400 flex items-center justify-center bg-white ml-0.5 mr-[1px] my-[1px] ${isIndividual ? 'opacity-100' : 'opacity-0'}`}>
                                </div>
                            </button>
                            {/* Non Biller Pill */}
                            <button type="button" onClick={() => setIsNonBiller(!isNonBiller)} className={`flex items-center rounded-full border border-slate-400 text-[10px] font-bold tracking-wider overflow-hidden transition-colors ${isNonBiller ? 'bg-slate-400 text-white' : 'bg-white text-slate-400'}`}>
                                <span className="px-3 py-0.5">NON-BILLER</span>
                                <div className={`w-5 h-5 rounded-full border border-slate-400 flex items-center justify-center bg-white ml-0.5 mr-[1px] my-[1px] ${isNonBiller ? 'opacity-100' : 'opacity-0'}`}>
                                </div>
                            </button>
                        </div>
                    </CardHeader>

                    <CardContent className="p-8 pt-12 space-y-6 bg-white">
                        {/* Row 1: Names and Biller */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-1">
                                <div className="flex justify-between items-center">
                                    <Label className="text-xs text-slate-600 font-medium">First Name</Label>
                                    <span className="text-[10px] text-slate-400">required</span>
                                </div>
                                <Input required defaultValue={initialData?.first_name} className="bg-white border-slate-200 h-10 rounded-sm focus-visible:ring-1 focus-visible:ring-teal-500 shadow-none border-b-2 border-b-teal-500" />
                            </div>
                            <div className="space-y-1">
                                <div className="flex justify-between items-center">
                                    <Label className="text-xs text-slate-600 font-medium">Last Name</Label>
                                    <span className="text-[10px] text-slate-400">required</span>
                                </div>
                                <Input required defaultValue={initialData?.last_name} className="bg-slate-50 border-transparent hover:border-slate-200 focus:bg-white h-10 rounded-sm shadow-none" />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs text-slate-600 font-medium">Biller</Label>
                                <Select defaultValue={initialData?.biller || ""}>
                                    <SelectTrigger className="bg-slate-50 border-transparent hover:border-slate-200 h-10 rounded-sm shadow-none">
                                        <SelectValue placeholder="Choose A Biller..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">None</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Row 2: Street Addresses */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-1">
                                <Label className="text-xs text-slate-600 font-medium">Street Address 1</Label>
                                <Input defaultValue={initialData?.street_address_1 || ""} className="bg-slate-50 border-transparent hover:border-slate-200 focus:bg-white h-10 rounded-sm shadow-none" />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs text-slate-600 font-medium">Street Address 2</Label>
                                <Input defaultValue={initialData?.street_address_2 || ""} className="bg-slate-50 border-transparent hover:border-slate-200 focus:bg-white h-10 rounded-sm shadow-none" />
                            </div>
                        </div>

                        {/* Row 3: Street Suburb etc */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-1">
                                <Label className="text-xs text-slate-600 font-medium">Street Suburb</Label>
                                <Input defaultValue={initialData?.street_suburb || ""} className="bg-slate-50 border-transparent hover:border-slate-200 focus:bg-white h-10 rounded-sm shadow-none" />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs text-slate-600 font-medium">Street State</Label>
                                <Select defaultValue={initialData?.street_state || ""}>
                                    <SelectTrigger className="bg-slate-50 border-transparent hover:border-slate-200 h-10 rounded-sm shadow-none">
                                        <SelectValue placeholder="Select state..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="nsw">New South Wales</SelectItem>
                                        <SelectItem value="vic">Victoria</SelectItem>
                                        <SelectItem value="qld">Queensland</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs text-slate-600 font-medium">Postcode</Label>
                                <Input defaultValue={initialData?.street_postcode || ""} className="bg-slate-50 border-transparent hover:border-slate-200 focus:bg-white h-10 rounded-sm shadow-none" />
                            </div>
                        </div>

                        {/* Row 4: Postal Addresses */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-1">
                                <Label className="text-xs text-slate-600 font-medium">Postal Address 1</Label>
                                <Input defaultValue={initialData?.postal_address_1 || ""} className="bg-slate-50 border-transparent hover:border-slate-200 focus:bg-white h-10 rounded-sm shadow-none" />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs text-slate-600 font-medium">Postal Address 2</Label>
                                <Input defaultValue={initialData?.postal_address_2 || ""} className="bg-slate-50 border-transparent hover:border-slate-200 focus:bg-white h-10 rounded-sm shadow-none" />
                            </div>
                        </div>

                        {/* Row 5: Postal Suburb etc */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-1">
                                <Label className="text-xs text-slate-600 font-medium">Postal Suburb</Label>
                                <Input defaultValue={initialData?.postal_suburb || ""} className="bg-slate-50 border-transparent hover:border-slate-200 focus:bg-white h-10 rounded-sm shadow-none" />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs text-slate-600 font-medium">Postal State</Label>
                                <Select defaultValue={initialData?.postal_state || ""}>
                                    <SelectTrigger className="bg-slate-50 border-transparent hover:border-slate-200 h-10 rounded-sm shadow-none">
                                        <SelectValue placeholder="Select state..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="nsw">New South Wales</SelectItem>
                                        <SelectItem value="vic">Victoria</SelectItem>
                                        <SelectItem value="qld">Queensland</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs text-slate-600 font-medium">Postcode</Label>
                                <Input defaultValue={initialData?.postal_postcode || ""} className="bg-slate-50 border-transparent hover:border-slate-200 focus:bg-white h-10 rounded-sm shadow-none" />
                            </div>
                        </div>

                        {/* Row 6: Phones & Fax */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-1">
                                <Label className="text-xs text-slate-600 font-medium">Phone</Label>
                                <Input defaultValue={initialData?.phone || ""} className="bg-slate-50 border-transparent hover:border-slate-200 focus:bg-white h-10 rounded-sm shadow-none" />
                            </div>
                            <div className="space-y-1 relative">
                                <Label className="text-xs text-slate-600 font-medium">Mobile</Label>
                                <div className="relative">
                                    <Input defaultValue={initialData?.mobile || ""} className="bg-slate-50 border-transparent hover:border-slate-200 focus:bg-white h-10 rounded-sm shadow-none pr-10" />
                                    <div className="absolute right-0 top-0 h-full w-10 bg-slate-400 rounded-r-sm flex items-center justify-center">
                                        <MessageSquare className="w-4 h-4 text-white" />
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs text-slate-600 font-medium">Fax</Label>
                                <Input defaultValue={initialData?.fax || ""} className="bg-slate-50 border-transparent hover:border-slate-200 focus:bg-white h-10 rounded-sm shadow-none" />
                            </div>
                        </div>

                        {/* Row 7: Digital / Web */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-1 relative">
                                <Label className="text-xs text-slate-600 font-medium">Email</Label>
                                <div className="relative">
                                    <Input defaultValue={initialData?.email || ""} className="bg-slate-50 border-transparent hover:border-slate-200 focus:bg-white h-10 rounded-sm shadow-none pr-10" />
                                    <div className="absolute right-0 top-0 h-full w-10 border-l border-slate-200 flex items-center justify-center pointer-events-none">
                                        <Mail className="w-4 h-4 text-slate-400" />
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs text-slate-600 font-medium">Web</Label>
                                <Input defaultValue={initialData?.web || ""} className="bg-slate-50 border-transparent hover:border-slate-200 focus:bg-white h-10 rounded-sm shadow-none" />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs text-slate-600 font-medium">Preferred Method Of Contact</Label>
                                <Select defaultValue={initialData?.preferred_contact_method || ""}>
                                    <SelectTrigger className="bg-slate-50 border-transparent hover:border-slate-200 h-10 rounded-sm shadow-none">
                                        <SelectValue placeholder="Select..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="email">Email</SelectItem>
                                        <SelectItem value="phone">Phone</SelectItem>
                                        <SelectItem value="sms">SMS</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Row 8: Rates */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-1 relative">
                                <Label className="text-xs text-slate-600 font-medium">Hourly Rate</Label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-medium">$</span>
                                    <Input type="number" defaultValue={initialData?.hourly_rate || ""} className="bg-slate-50 border-transparent hover:border-slate-200 focus:bg-white h-10 rounded-sm shadow-none pl-7" />
                                </div>
                            </div>
                            <div className="space-y-1 relative">
                                <Label className="text-xs text-slate-600 font-medium">Discount</Label>
                                <div className="relative">
                                    <Input type="number" defaultValue={initialData?.discount || ""} className="bg-slate-50 border-transparent hover:border-slate-200 focus:bg-white h-10 rounded-sm shadow-none pr-8" />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 font-medium">%</span>
                                </div>
                            </div>
                            <div className="space-y-1 relative">
                                <Label className="text-xs text-slate-600 font-medium">Markup</Label>
                                <div className="relative">
                                    <Input type="number" defaultValue={initialData?.markup || ""} className="bg-slate-50 border-transparent hover:border-slate-200 focus:bg-white h-10 rounded-sm shadow-none pr-8" />
                                    <div className="absolute right-0 top-0 h-full w-10 bg-teal-600 rounded-r-sm flex items-center justify-center pointer-events-none cursor-pointer">
                                        <span className="text-white font-medium">%</span>
                                    </div>
                                    {/* Question mark tool tip indicator in mockup next to it - appending a small absolutely positioned circle */}
                                    <div className="absolute -right-10 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-teal-700 flex items-center justify-center text-white text-xs font-bold cursor-help shadow-md">
                                        ?
                                    </div>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Floating Save Bar (mimicking form actions in SaaS) 
                    Not strictly in the screenshot (it might be cut off), but vital for user flow
                */}
                <div className="flex justify-end gap-3 mt-6 mr-10">
                    <Button type="button" variant="outline" onClick={() => router.push("/demo-tenant/dashboard/customers")} className="bg-white border-slate-300 text-slate-700">Cancel</Button>
                    <Button type="submit" className="bg-teal-600 hover:bg-teal-700 text-white">
                        <Save className="w-4 h-4 mr-2" />
                        Save Customer
                    </Button>
                </div>
            </form>
        </div>
    );
}
