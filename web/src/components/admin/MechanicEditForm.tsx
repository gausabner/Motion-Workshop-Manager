"use client";

import { useState } from "react";
import { Settings, Plus, ExternalLink, UserPlus, Minus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useRouter } from "next/navigation";

// Schedule Days
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

interface MechanicEditFormProps {
    id: string;
}

export function MechanicEditForm({ id }: MechanicEditFormProps) {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState("Monday");

    const handleSave = () => {
        // In a real app, this would post to an API
        router.push("/demo-tenant/admin/mechanics");
    };

    const handleDelete = () => {
        // API delete trigger goes here
        router.push("/demo-tenant/admin/mechanics");
    };

    return (
        <div className="w-full max-w-7xl mx-auto h-full flex flex-col pb-12">
            <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
                <Card className="rounded-none shadow-none border border-slate-200">

                    {/* Header Section */}
                    <CardHeader className="bg-slate-200 border-b py-3 px-6 flex flex-row items-center justify-between space-y-0 h-14">
                        <div className="flex items-center gap-3">
                            <Settings className="w-6 h-6 text-slate-500" />
                            <CardTitle className="text-xl text-slate-800 font-bold">Mechanic Details: Edit Me Mechanic 1</CardTitle>
                        </div>

                        {/* Right-aligned Header Actions */}
                        <div className="flex items-center gap-4">
                            {/* Active Toggle */}
                            <div className="flex items-center bg-teal-500 rounded-full px-2 py-1 gap-2 shadow-sm border border-teal-600">
                                <Switch defaultChecked className="data-[state=checked]:bg-white scale-75 origin-left" />
                                <span className="text-[10px] font-bold text-white uppercase tracking-wider mr-2">Active</span>
                            </div>

                            {/* Add User Icon */}
                            <button type="button" className="text-slate-500 hover:text-slate-700">
                                <UserPlus className="w-5 h-5" />
                            </button>

                            {/* External Link Icon */}
                            <button type="button" className="text-slate-500 hover:text-slate-700">
                                <ExternalLink className="w-5 h-5" />
                            </button>
                        </div>
                    </CardHeader>

                    <CardContent className="p-8 pt-8 space-y-8 bg-white">
                        {/* Section 1: Basic Info */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            <div className="space-y-1">
                                <Label className="text-xs text-slate-600 font-medium">Mechanic Code</Label>
                                <Input
                                    className="bg-white border-teal-500 border-2 focus:ring-0 h-10 rounded-sm shadow-sm font-medium"
                                />
                            </div>
                            <div className="space-y-1">
                                <div className="flex justify-between items-center">
                                    <Label className="text-xs text-slate-600 font-medium">First Name</Label>
                                    <span className="text-[10px] text-slate-400">required</span>
                                </div>
                                <Input
                                    required
                                    defaultValue="Edit Me"
                                    className="bg-slate-50 border-transparent hover:border-slate-200 focus:bg-white h-10 rounded-sm shadow-none"
                                />
                            </div>
                            <div className="space-y-1">
                                <div className="flex justify-between items-center">
                                    <Label className="text-xs text-slate-600 font-medium">Last Name</Label>
                                    <span className="text-[10px] text-slate-400">required</span>
                                </div>
                                <Input
                                    required
                                    defaultValue="Mechanic 1"
                                    className="bg-slate-50 border-transparent hover:border-slate-200 focus:bg-white h-10 rounded-sm shadow-none"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs text-slate-600 font-medium h-5 flex items-center">Cost Per Hour</Label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <span className="text-slate-500 sm:text-sm">$</span>
                                    </div>
                                    <Input
                                        type="number"
                                        defaultValue="35"
                                        className="pl-8 bg-slate-50 border-transparent hover:border-slate-200 focus:bg-white h-10 rounded-sm shadow-none"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1 md:col-span-4 pt-4">
                                <Label className="text-xs text-slate-600 font-medium">Mobile</Label>
                                <div className="relative w-1/4">
                                    <Input
                                        className="bg-slate-50 border-transparent hover:border-slate-200 focus:bg-white h-10 rounded-sm shadow-none pr-12"
                                    />
                                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                        <span className="text-teal-500 sm:text-xs font-semibold cursor-pointer pointer-events-auto">SMS</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Section 2: Notes */}
                        <div className="space-y-1">
                            <Label className="text-xs text-slate-600 font-medium">Notes</Label>
                            <Textarea
                                defaultValue="Mechanic Hourly Rate definition: Total Labour Cost - Gross Hourly Rate + pro rata Hourly Rate for Allowances (eg Tool Allowance) + Superannuation + pro rata hourly rate for other Labour costs (eg WorkCover, uniforms, private use of Company vehicles)"
                                className="min-h-[120px] bg-slate-50 border-transparent hover:border-slate-200 focus:bg-white rounded-sm shadow-none resize-y text-sm text-slate-700"
                            />
                        </div>

                        {/* Section 3: Schedule */}
                        <div className="space-y-6 pt-6 border-t border-slate-200">
                            <h3 className="text-slate-800 font-bold text-lg">Schedule</h3>

                            {/* Days Tabs */}
                            <div className="flex border-b border-slate-200">
                                {DAYS.map(day => (
                                    <button
                                        key={day}
                                        type="button"
                                        onClick={() => setActiveTab(day)}
                                        className={`px-4 py-2 text-sm font-medium border-b-2 -mb-[1px] ${activeTab === day
                                                ? "border-teal-500 text-teal-600 bg-white"
                                                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                                            } transition-colors`}
                                    >
                                        {day}
                                    </button>
                                ))}
                            </div>

                            {/* Schedule Times */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
                                <div className="space-y-1">
                                    <Label className="text-xs text-slate-600 font-medium">Start Time</Label>
                                    <div className="relative">
                                        <Input
                                            defaultValue="1:00 AM"
                                            className="bg-slate-50 border-transparent hover:border-slate-200 focus:bg-white h-10 rounded-sm shadow-none pl-10 text-sm"
                                        />
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            {/* Minimalistic Clock Icon roughly matching reference */}
                                            <svg className="w-4 h-4 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs text-slate-600 font-medium">End Time</Label>
                                    <div className="relative">
                                        <Input
                                            defaultValue="11:00 AM"
                                            className="bg-slate-50 border-transparent hover:border-slate-200 focus:bg-white h-10 rounded-sm shadow-none pl-10 text-sm"
                                        />
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <svg className="w-4 h-4 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-1 flex flex-col justify-end">
                                    <Label className="text-xs text-slate-600 font-medium h-5">Persist Schedule Monday-Friday</Label>
                                    <Button type="button" className="bg-teal-600 hover:bg-teal-700 text-white h-8 px-4 rounded-sm shadow-sm w-fit w-[80px]">
                                        Persist
                                    </Button>
                                </div>
                            </div>

                            {/* Minus Button Row */}
                            <div className="pt-2">
                                <Button size="icon" variant="outline" type="button" className="w-8 h-8 rounded-sm border-red-300 text-red-500 hover:bg-red-50 shadow-sm">
                                    <Minus className="w-4 h-4" />
                                </Button>
                            </div>

                            {/* Unavailable Times Row */}
                            <div className="space-y-4 pt-6">
                                <Label className="text-xs text-slate-600 font-medium block">Unavailable Times</Label>
                                <div className="flex gap-2">
                                    <Button size="icon" variant="outline" type="button" className="w-8 h-8 rounded-sm border-amber-400 bg-amber-400 text-white hover:bg-amber-500 shadow-sm">
                                        <Minus className="w-5 h-5" />
                                    </Button>
                                    <Button size="icon" variant="outline" type="button" className="w-8 h-8 rounded-sm border-teal-600 bg-teal-600 text-white hover:bg-teal-700 shadow-sm">
                                        <Plus className="w-5 h-5" />
                                    </Button>
                                </div>
                            </div>
                        </div>

                    </CardContent>

                    {/* Footer Actions */}
                    <CardFooter className="bg-white border-t border-slate-200 px-8 py-4 flex justify-between items-center mt-8">
                        <div className="flex gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => router.push("/demo-tenant/admin/mechanics")}
                                className="bg-white border-slate-300 text-slate-700 h-9 px-6 rounded-sm shadow-sm"
                            >
                                Cancel
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleDelete}
                                className="bg-white border-red-200 text-red-500 hover:bg-red-50 hover:text-red-600 h-9 px-6 rounded-sm shadow-sm"
                            >
                                Delete
                            </Button>
                        </div>
                        <Button
                            type="submit"
                            className="bg-teal-600 hover:bg-teal-700 text-white h-9 px-6 rounded-sm shadow-sm"
                        >
                            Save
                        </Button>
                    </CardFooter>
                </Card>
            </form>
        </div>
    );
}
