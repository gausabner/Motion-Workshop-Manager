"use client";

import { User, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useRouter, useParams } from "next/navigation";

export function ServiceAdvisorForm() {
    const { tenant } = useParams<{ tenant: string }>();
    const router = useRouter();

    const handleSave = () => {
        // In a real app, this would post to an API
        router.push(`/${tenant}/admin/service-advisors`);
    };

    return (
        <div className="w-full max-w-7xl mx-auto h-full flex flex-col pb-12">
            <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
                <Card className="rounded-none shadow-none border border-slate-200">
                    {/* Header Section */}
                    <CardHeader className="bg-slate-200 border-b py-3 px-6 flex flex-row items-center space-y-0">
                        <div className="flex items-center gap-3">
                            <User className="w-6 h-6 text-slate-500" />
                            <CardTitle className="text-xl text-slate-800 font-normal">Service Advisor</CardTitle>
                        </div>
                    </CardHeader>

                    <CardContent className="p-8 pt-8 space-y-6 bg-white">
                        {/* Row 1: Basic Info */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-1">
                                <div className="flex justify-between items-center">
                                    <Label className="text-xs text-slate-600 font-medium">Advisor Code</Label>
                                    <span className="text-[10px] text-slate-400">required</span>
                                </div>
                                <Input
                                    required
                                    defaultValue="1028"
                                    className="bg-slate-50 border-transparent hover:border-slate-200 focus:bg-white h-10 rounded-sm shadow-none"
                                />
                            </div>
                            <div className="space-y-1">
                                <div className="flex justify-between items-center">
                                    <Label className="text-xs text-slate-600 font-medium">First Name</Label>
                                    <span className="text-[10px] text-slate-400">required</span>
                                </div>
                                <Input
                                    required
                                    defaultValue="Oscar"
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
                                    defaultValue="Shilipipo"
                                    className="bg-slate-50 border-transparent hover:border-slate-200 focus:bg-white h-10 rounded-sm shadow-none"
                                />
                            </div>
                        </div>

                        {/* Row 2: Contact Info */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-1">
                                <Label className="text-xs text-slate-600 font-medium">Phone</Label>
                                <Input
                                    defaultValue="0816550613"
                                    className="bg-[#eef2fc] border-transparent hover:border-teal-200 focus:bg-white h-10 rounded-sm shadow-none text-slate-800"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs text-slate-600 font-medium">Mobile Number</Label>
                                <Input
                                    defaultValue="0816550613"
                                    className="bg-[#eef2fc] border-transparent hover:border-teal-200 focus:bg-white h-10 rounded-sm shadow-none text-slate-800"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs text-slate-600 font-medium">Email</Label>
                                <Input
                                    defaultValue="gideonabner490@gmail.com"
                                    className="bg-[#eef2fc] border-transparent hover:border-teal-200 focus:bg-white h-10 rounded-sm shadow-none text-slate-800"
                                />
                            </div>
                        </div>

                        {/* Row 3: Notes */}
                        <div className="space-y-1 pt-2">
                            <Label className="text-xs text-slate-600 font-medium">Notes</Label>
                            <Textarea
                                defaultValue="I'm available from 08:00 am until 17:00 pm. Please leave a tip for coffee."
                                className="min-h-[150px] bg-slate-50 border-transparent hover:border-slate-200 focus:bg-white rounded-sm shadow-none resize-y"
                            />
                        </div>
                    </CardContent>

                    {/* Footer Actions */}
                    <CardFooter className="bg-white border-t border-slate-200 px-8 py-4 flex justify-between items-center">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => router.push(`/${tenant}/admin/service-advisors`)}
                            className="bg-white border-slate-300 text-slate-700 h-9 px-6 rounded-sm shadow-sm"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            className="bg-teal-600 hover:bg-teal-700 text-white h-9 px-6 rounded-sm shadow-sm"
                        >
                            <Save className="w-4 h-4 mr-2" />
                            Save
                        </Button>
                    </CardFooter>
                </Card>
            </form>
        </div>
    );
}
