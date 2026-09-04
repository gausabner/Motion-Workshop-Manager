"use client";

import { User, HelpCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export function UserForm() {
    const router = useRouter();

    const handleSave = () => {
        // In a real app, this would post to an API
        router.push("/demo-tenant/admin/users");
    };

    return (
        <div className="w-full max-w-7xl mx-auto h-full flex flex-col pb-12">
            <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
                <Card className="rounded-none shadow-none border border-slate-200">
                    {/* Header Section */}
                    <CardHeader className="bg-slate-200 border-b py-3 px-6 flex flex-row items-center justify-between space-y-0 h-14">
                        <div className="flex items-center gap-3">
                            <User className="w-6 h-6 text-slate-500" />
                            <CardTitle className="text-xl text-slate-800 font-bold">New User</CardTitle>
                        </div>

                        {/* Notice Banner inside header right-aligned based on screenshot */}
                        <div className="bg-[#fff9e6] text-[#b48600] text-sm px-6 py-1.5 border border-[#ffe082] flex items-center h-8">
                            An additional yearly subscription fee of $240.00 will be charged upon creation of this user.
                        </div>
                    </CardHeader>

                    <CardContent className="p-8 pt-8 space-y-6 bg-white">
                        {/* Row 1: Group and Status */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
                            <div className="space-y-1">
                                <div className="flex justify-between items-center">
                                    <Label className="text-xs text-slate-600 font-medium">Group</Label>
                                    <span className="text-[10px] text-slate-400">required</span>
                                </div>
                                <Select required>
                                    <SelectTrigger className="bg-slate-50 border-transparent hover:border-slate-200 focus:ring-0 focus:ring-offset-0 h-10 rounded-sm shadow-none">
                                        <SelectValue placeholder="Select a group" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="admin">ADMIN</SelectItem>
                                        <SelectItem value="user">USER</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs text-slate-600 font-medium">Status</Label>
                                <Select defaultValue="active">
                                    <SelectTrigger className="bg-slate-50 border-transparent hover:border-slate-200 focus:ring-0 focus:ring-offset-0 h-10 rounded-sm shadow-none">
                                        <SelectValue placeholder="Status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="active">Active</SelectItem>
                                        <SelectItem value="inactive">Inactive</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Row 2: Names */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
                            <div className="space-y-1">
                                <div className="flex justify-between items-center">
                                    <Label className="text-xs text-slate-600 font-medium">First Name</Label>
                                    <span className="text-[10px] text-slate-400">required</span>
                                </div>
                                <Input
                                    required
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
                                    className="bg-slate-50 border-transparent hover:border-slate-200 focus:bg-white h-10 rounded-sm shadow-none"
                                />
                            </div>
                        </div>

                        {/* Row 3: Email, Mobile, Privileges */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 w-full max-w-4xl">
                            <div className="space-y-1 col-span-1">
                                <div className="flex justify-between items-center">
                                    <Label className="text-xs text-slate-600 font-medium">Email</Label>
                                    <span className="text-[10px] text-slate-400">required</span>
                                </div>
                                <Input
                                    type="email"
                                    required
                                    className="bg-slate-50 border-transparent hover:border-slate-200 focus:bg-white h-10 rounded-sm shadow-none"
                                />
                            </div>
                            <div className="space-y-1 col-span-1">
                                <Label className="text-xs text-slate-600 font-medium">Mobile</Label>
                                <Input
                                    className="bg-slate-50 border-transparent hover:border-slate-200 focus:bg-white h-10 rounded-sm shadow-none"
                                />
                            </div>
                            <div className="space-y-1 col-span-1 pl-4">
                                <Label className="text-xs text-slate-600 font-medium block h-5">Dashboard Privileges</Label>
                                <div className="flex items-center h-10">
                                    <div className="flex items-center gap-2 border border-slate-300 rounded-full px-1.5 py-1 pr-3 bg-white">
                                        <Switch id="dashboard-limit" />
                                        <Label htmlFor="dashboard-limit" className="text-[10px] font-bold text-teal-600 uppercase tracking-wide cursor-pointer">Limit</Label>
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-1 col-span-1">
                                <Label className="text-xs text-slate-600 font-medium block h-5">Business Intelligence</Label>
                                <div className="flex items-center h-10">
                                    <div className="flex items-center gap-2 border border-slate-300 rounded-full px-1.5 py-1 pr-3 bg-white">
                                        <Switch id="business-intelligence" />
                                        <Label htmlFor="business-intelligence" className="text-[10px] font-bold text-teal-600 uppercase tracking-wide cursor-pointer">Inactive</Label>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Row 4: Password */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl pt-2">
                            <div className="space-y-1">
                                <div className="flex justify-between items-center">
                                    <Label className="text-xs text-slate-600 font-medium">Password</Label>
                                    <span className="text-[10px] text-slate-400">required</span>
                                </div>
                                <div className="relative">
                                    <Input
                                        type="password"
                                        required
                                        className="bg-slate-50 border-transparent hover:border-slate-200 focus:bg-white h-10 rounded-sm shadow-none pr-10"
                                    />
                                    <HelpCircle className="w-5 h-5 text-slate-700 absolute right-3 top-1/2 -translate-y-1/2 fill-slate-200" />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs text-slate-600 font-medium">Confirm Password</Label>
                                <Input
                                    type="password"
                                    className="bg-slate-50 border-transparent hover:border-slate-200 focus:bg-white h-10 rounded-sm shadow-none"
                                />
                            </div>
                        </div>

                    </CardContent>

                    {/* Footer Actions */}
                    <CardFooter className="bg-white border-t border-slate-200 px-8 py-4 flex justify-between items-center">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => router.push("/demo-tenant/admin/users")}
                            className="bg-white border-slate-300 text-slate-700 h-9 px-6 rounded-sm shadow-sm"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            className="bg-slate-400 hover:bg-slate-500 text-white h-9 px-6 rounded-sm shadow-sm"
                        >
                            Save
                        </Button>
                    </CardFooter>
                </Card>
            </form>
        </div>
    );
}
