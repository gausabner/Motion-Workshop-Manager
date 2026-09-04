"use client";

import { User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

interface ServiceAdvisorEditFormProps {
    id: string;
}

export function ServiceAdvisorEditForm({ id }: ServiceAdvisorEditFormProps) {
    const router = useRouter();

    const handleSave = () => {
        // In a real app, this would update via API
        router.push("/demo-tenant/admin/service-advisors");
    };

    const handleDelete = () => {
        // In a real app, this would delete via API
        router.push("/demo-tenant/admin/service-advisors");
    };

    return (
        <div className="w-full max-w-7xl mx-auto h-full flex flex-col pb-12">
            <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
                <Card className="rounded-none shadow-none border border-slate-200">
                    <CardHeader className="bg-slate-200 border-b py-3 px-6 flex flex-row items-center space-y-0 h-14">
                        <div className="flex items-center gap-3">
                            <User className="w-6 h-6 text-slate-500" />
                            <CardTitle className="text-xl text-slate-800 font-bold">Service Advisor</CardTitle>
                        </div>
                    </CardHeader>

                    <CardContent className="p-8 pt-8 space-y-6 bg-white">
                        {/* Row 1: Identifiers */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-1">
                                <div className="flex justify-between items-center">
                                    <Label className="text-xs text-slate-600 font-medium">Advisor Code</Label>
                                    <span className="text-[10px] text-slate-400">required</span>
                                </div>
                                <Input
                                    required
                                    defaultValue={id === "1" ? "1028" : "1001"}
                                    className="bg-slate-50 border-transparent hover:border-slate-200 focus:bg-white h-10 rounded-sm shadow-none font-medium"
                                />
                            </div>
                            <div className="space-y-1">
                                <div className="flex justify-between items-center">
                                    <Label className="text-xs text-slate-600 font-medium">First Name</Label>
                                    <span className="text-[10px] text-slate-400">required</span>
                                </div>
                                <Input
                                    required
                                    defaultValue={id === "1" ? "Oscar" : "Test"}
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
                                    defaultValue={id === "1" ? "Shilipipo" : "Advisor"}
                                    className="bg-slate-50 border-transparent hover:border-slate-200 focus:bg-white h-10 rounded-sm shadow-none"
                                />
                            </div>
                        </div>

                        {/* Row 2: Contact Info */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-1">
                                <Label className="text-xs text-slate-600 font-medium h-5 flex items-center">Phone</Label>
                                <Input
                                    defaultValue={id === "1" ? "0816550616" : ""}
                                    className="bg-slate-50 border-transparent hover:border-slate-200 focus:bg-white h-10 rounded-sm shadow-none"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs text-slate-600 font-medium h-5 flex items-center">Mobile Number</Label>
                                <Input
                                    defaultValue={id === "1" ? "0816550616" : "1234567890"}
                                    className="bg-slate-50 border-transparent hover:border-slate-200 focus:bg-white h-10 rounded-sm shadow-none"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs text-slate-600 font-medium h-5 flex items-center">Email</Label>
                                <Input
                                    type="email"
                                    defaultValue={id === "1" ? "oscar@gmail.com" : "advisor@example.com"}
                                    className="bg-slate-50 border-transparent hover:border-slate-200 focus:bg-white h-10 rounded-sm shadow-none"
                                />
                            </div>
                        </div>

                        {/* Row 3: Notes */}
                        <div className="space-y-1 pt-2">
                            <Label className="text-xs text-slate-600 font-medium">Notes</Label>
                            <Textarea
                                defaultValue={id === "1" ? "I'm available from 08:00 am until 17:00 pm. Please leave a tip for coffee." : ""}
                                className="min-h-[150px] bg-slate-50 border-transparent hover:border-slate-200 focus:bg-white rounded-sm shadow-none resize-y text-sm"
                            />
                        </div>
                    </CardContent>

                    {/* Footer Actions */}
                    <CardFooter className="bg-white border-t border-slate-200 px-8 py-4 flex justify-between items-center">
                        <div className="flex gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => router.push("/demo-tenant/admin/service-advisors")}
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
