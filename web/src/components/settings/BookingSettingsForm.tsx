"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import {
    Users,
    Calendar,
    Settings,
    PaintBucket,
    ChevronDown,
    ChevronUp,
    Link as LinkIcon,
    RefreshCw,
    Plus
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

const bookingFormSchema = z.object({
    publicUrl: z.string(),
    bookingDiaryFullAtPercent: z.string(),
    setBookingScheduleHours: z.boolean(),
    sendLinkInReminders: z.boolean(),
    navbarColor: z.string(),
    boxHeaderColor: z.string(),
});

type BookingFormValues = z.infer<typeof bookingFormSchema>;

const defaultValues: Partial<BookingFormValues> = {
    publicUrl: "https://my.workshopsoftware.com/bookings.html#/TipTopAutoCare?token=r9k0ik",
    bookingDiaryFullAtPercent: "100",
    setBookingScheduleHours: false,
    sendLinkInReminders: false,
    navbarColor: "#1d6a8a",
    boxHeaderColor: "#1d6a8a",
};

export function BookingSettingsForm() {
    // Client-side hydration safety

    // UI Expand State (all true by default for better visibility)
    const [openUrl, setOpenUrl] = useState(true);
    const [openTypes, setOpenTypes] = useState(true);
    const [openSettings, setOpenSettings] = useState(true);
    const [openBranding, setOpenBranding] = useState(true);

    const form = useForm<BookingFormValues>({
        resolver: zodResolver(bookingFormSchema),
        defaultValues,
    });


    function onSubmit(data: BookingFormValues) {
        console.log("Bookings Settings Update Submitted:", data);
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-7xl mx-auto pb-24">

                {/* 1. Public URL Block */}
                <div className="border border-slate-300 rounded-sm overflow-hidden bg-white shadow-sm">
                    <div
                        onClick={() => setOpenUrl(!openUrl)}
                        className="bg-[#e6e6e6] px-4 py-3 flex items-center justify-between cursor-pointer border-b border-slate-300"
                    >
                        <div className="flex items-center gap-2 text-slate-700 font-bold">
                            <Users className="w-5 h-5 text-slate-500 fill-slate-500" />
                            <span className="text-sm">Public URL</span>
                        </div>
                        {openUrl ? <ChevronUp className="w-4 h-4 text-slate-500 stroke-[3]" /> : <ChevronDown className="w-4 h-4 text-slate-500 stroke-[3]" />}
                    </div>

                    {openUrl && (
                        <div className="p-6">
                            <FormField control={form.control} name="publicUrl" render={({ field }) => (
                                <FormItem>
                                    <FormControl>
                                        <div className="bg-[#fcfcfc] border border-slate-200 p-3 rounded-sm text-sm text-slate-700 flex items-center shadow-sm">
                                            <span className="text-slate-500 mr-1">Your public URL:</span>
                                            <a href={field.value} className="text-slate-700 hover:text-black transition-colors" target="_blank" rel="noopener noreferrer">
                                                {field.value}
                                            </a>
                                        </div>
                                    </FormControl>
                                </FormItem>
                            )} />
                        </div>
                    )}
                </div>

                {/* 2. Appointment Types Block */}
                <div className="border border-slate-300 rounded-sm overflow-hidden bg-white shadow-sm">
                    <div
                        onClick={() => setOpenTypes(!openTypes)}
                        className="bg-[#e6e6e6] px-4 py-3 flex items-center justify-between cursor-pointer border-b border-slate-300"
                    >
                        <div className="flex items-center gap-2 text-slate-700 font-bold">
                            <Calendar className="w-5 h-5 text-slate-500" strokeWidth={3} />
                            <span className="text-sm">Appointment Types</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                <Plus className="w-4 h-4 text-slate-500 hover:text-slate-800 cursor-pointer stroke-[3]" />
                                <RefreshCw className="w-4 h-4 text-slate-500 hover:text-slate-800 cursor-pointer stroke-[3]" />
                            </div>
                            {openTypes ? <ChevronUp className="w-4 h-4 text-slate-500 stroke-[3]" /> : <ChevronDown className="w-4 h-4 text-slate-500 stroke-[3]" />}
                        </div>
                    </div>

                    {openTypes && (
                        <div className="p-6">
                            <div className="w-full border border-slate-200 rounded-sm overflow-hidden shadow-sm">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-slate-500 bg-[#fefefe] border-b border-slate-200">
                                        <tr>
                                            <th className="px-4 py-3 font-normal">Description</th>
                                            <th className="px-4 py-3 font-normal w-48 text-right pr-12">Estimated Hours</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-slate-600 bg-white">
                                        <tr className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                                            <td className="px-4 py-3.5">Repair</td>
                                            <td className="px-4 py-3.5 text-right pr-20">1.0</td>
                                        </tr>
                                        <tr className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                                            <td className="px-4 py-3.5">Service</td>
                                            <td className="px-4 py-3.5 text-right pr-20">1.0</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination Footer */}
                            <div className="flex justify-end mt-4">
                                <div className="flex items-center text-xs text-slate-500 border border-slate-200 rounded-sm bg-white shadow-sm overflow-hidden h-8">
                                    <div className="px-3 border-r border-slate-200 flex items-center h-full">10 records</div>
                                    <div className="px-3 border-r border-slate-200 flex items-center h-full text-slate-300 cursor-not-allowed">First Page</div>
                                    <div className="px-2 border-r border-slate-200 flex items-center h-full text-slate-300 cursor-not-allowed">←</div>
                                    <div className="px-3 border-r border-slate-200 flex items-center h-full text-teal-600 font-medium">1</div>
                                    <div className="px-2 border-r border-slate-200 flex items-center h-full text-slate-300 cursor-not-allowed">→</div>
                                    <div className="px-3 flex items-center h-full text-slate-300 cursor-not-allowed">Last Page</div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* 3. Booking Settings Toggle Block */}
                <div className="border border-slate-300 rounded-sm overflow-hidden bg-white shadow-sm">
                    <div
                        onClick={() => setOpenSettings(!openSettings)}
                        className="bg-[#e6e6e6] px-4 py-3 flex items-center justify-between cursor-pointer border-b border-slate-300"
                    >
                        <div className="flex items-center gap-2 text-slate-700 font-bold">
                            <Settings className="w-5 h-5 text-slate-500 fill-slate-500" />
                            <span className="text-sm">Booking Settings</span>
                        </div>
                        {openSettings ? <ChevronUp className="w-4 h-4 text-slate-500 stroke-[3]" /> : <ChevronDown className="w-4 h-4 text-slate-500 stroke-[3]" />}
                    </div>

                    {openSettings && (
                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8 lg:grid-cols-4">
                            <FormField control={form.control} name="setBookingScheduleHours" render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel className="text-xs text-slate-500 mb-2 font-normal">Set Booking Schedule Hours</FormLabel>
                                    <FormControl>
                                        <div><PillToggle checked={field.value} onChange={field.onChange} /></div>
                                    </FormControl>
                                </FormItem>
                            )} />

                            <FormField control={form.control} name="bookingDiaryFullAtPercent" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs text-slate-500 mb-1 font-normal">Booking Diary Full At Percent</FormLabel>
                                    <FormControl>
                                        <div className="relative max-w-[200px]">
                                            <Input className="bg-[#f5f5f5] border-none text-sm h-9 shadow-sm pr-8" {...field} />
                                            <span className="absolute right-3 top-[8px] text-xs font-bold text-slate-500">%</span>
                                        </div>
                                    </FormControl>
                                </FormItem>
                            )} />

                            <FormField control={form.control} name="sendLinkInReminders" render={({ field }) => (
                                <FormItem className="flex flex-col row-start-2">
                                    <FormLabel className="text-xs text-slate-500 mb-2 font-normal">Send Link In Reminders</FormLabel>
                                    <FormControl>
                                        <div><PillToggle checked={field.value} onChange={field.onChange} /></div>
                                    </FormControl>
                                </FormItem>
                            )} />
                        </div>
                    )}
                </div>

                {/* 4. Branding Block */}
                <div className="border border-slate-300 rounded-sm overflow-hidden bg-white shadow-sm">
                    <div
                        onClick={() => setOpenBranding(!openBranding)}
                        className="bg-[#e6e6e6] px-4 py-3 flex items-center justify-between cursor-pointer border-b border-slate-300"
                    >
                        <div className="flex items-center gap-2 text-slate-700 font-bold">
                            <PaintBucket className="w-5 h-5 text-slate-500 fill-slate-500" />
                            <span className="text-sm">Branding</span>
                        </div>
                        {openBranding ? <ChevronUp className="w-4 h-4 text-slate-500 stroke-[3]" /> : <ChevronDown className="w-4 h-4 text-slate-500 stroke-[3]" />}
                    </div>

                    {openBranding && (
                        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-8">
                            <div>
                                <FormLabel className="text-xs text-slate-500 mb-1 font-normal block">Public Bookings Logo</FormLabel>
                                <div className="flex items-center gap-0 max-w-[180px]">
                                    <button type="button" className="bg-white border border-slate-300 text-teal-600 text-xs px-3 h-7 rounded-l-sm shadow-sm flex-1 hover:bg-slate-50 transition-colors">
                                        Choose Image
                                    </button>
                                    <button type="button" className="bg-[#a3a3a3] text-white border border-transparent text-xs px-3 h-7 rounded-r-sm shadow-sm hover:bg-slate-500 transition-colors">
                                        Upload
                                    </button>
                                </div>
                            </div>

                            <FormField control={form.control} name="navbarColor" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs text-slate-500 mb-1 font-normal block">Navbar Color</FormLabel>
                                    <FormControl>
                                        <div className="h-10 w-full rounded-sm border-none shadow-sm cursor-pointer" style={{ backgroundColor: field.value }} onClick={() => console.log('Open color Picker for', field.name)} />
                                    </FormControl>
                                </FormItem>
                            )} />

                            <FormField control={form.control} name="boxHeaderColor" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs text-slate-500 mb-1 font-normal block">Box Header Color</FormLabel>
                                    <FormControl>
                                        <div className="h-10 w-full rounded-sm border-none shadow-sm cursor-pointer" style={{ backgroundColor: field.value }} onClick={() => console.log('Open color Picker for', field.name)} />
                                    </FormControl>
                                </FormItem>
                            )} />
                        </div>
                    )}
                </div>

            </form>
        </Form>
    );
}
