"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Wrench, Clock, FileText, Camera, DollarSign, Plus, Trash2, ArrowLeft } from "lucide-react";
import Link from "next/link";

// Mock Data for a single Job
const MOCK_JOB = {
    id: "jc_1",
    booking_id: "b1",
    customer_name: "Sarah Connor",
    vehicle_make: "Toyota",
    vehicle_model: "Hilux",
    registration_number: "T800-SKY",
    mileage: "145,000 km",
    status: "IN_PROGRESS",
    customer_notes: "Regular logbook service. Check brakes, they've been squeaking.",
    mechanic_notes: "Brake pads at 15%. Recommend replacement next service. Oil change completed.",
    assigned_mechanic: "Mike Engine",

    parts: [
        { id: "p1", part_number: "TY-OIL-5W", description: "Toyota 5W-30 Synthetic Oil (5L)", quantity: 1, unit_price: 85.00 },
        { id: "p2", part_number: "FIL-1029", description: "Oil Filter", quantity: 1, unit_price: 24.50 },
    ],
    labor: [
        { id: "l1", description: "Logbook Service - Minor", hours: 1.5, hourly_rate: 120.00 },
        { id: "l2", description: "Brake Inspection", hours: 0.5, hourly_rate: 120.00 }
    ]
};

export function JobCardDetail({ jobId, tenant }: { jobId: string, tenant: string }) {
    const [status, setStatus] = useState(MOCK_JOB.status);

    const calculateTotal = () => {
        const partsTotal = MOCK_JOB.parts.reduce((acc, p) => acc + (p.quantity * p.unit_price), 0);
        const laborTotal = MOCK_JOB.labor.reduce((acc, l) => acc + (l.hours * l.hourly_rate), 0);
        return partsTotal + laborTotal;
    };

    return (
        <div className="flex flex-col gap-6 max-w-6xl mx-auto pb-12">
            {/* Action Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href={`/${tenant}/dashboard/jobs`}>
                        <Button variant="outline" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
                    </Link>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold tracking-tight">RO #{jobId.split('_')[1] || "1024"}</h1>
                            <Badge className="bg-blue-100 text-blue-800 border-blue-200">{status}</Badge>
                        </div>
                        <p className="text-sm text-slate-500">{MOCK_JOB.customer_name} • {MOCK_JOB.vehicle_make} {MOCK_JOB.vehicle_model}</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <Select value={status} onValueChange={setStatus}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Update Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="DRAFT">Draft</SelectItem>
                            <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                            <SelectItem value="WAITING_ON_PARTS">Waiting on Parts</SelectItem>
                            <SelectItem value="COMPLETED">Completed (QC)</SelectItem>
                            <SelectItem value="INVOICED">Invoiced</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button className="font-semibold bg-green-600 hover:bg-green-700">
                        <DollarSign className="w-4 h-4 mr-2" /> Convert to Invoice
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Operational Canvas */}
                <div className="lg:col-span-2 space-y-6">

                    <Tabs defaultValue="materials" className="w-full">
                        <TabsList className="grid w-full grid-cols-4">
                            <TabsTrigger value="materials"><Wrench className="w-4 h-4 mr-2" /> Parts</TabsTrigger>
                            <TabsTrigger value="labor"><Clock className="w-4 h-4 mr-2" /> Labor</TabsTrigger>
                            <TabsTrigger value="notes"><FileText className="w-4 h-4 mr-2" /> Notes</TabsTrigger>
                            <TabsTrigger value="photos"><Camera className="w-4 h-4 mr-2" /> Photos</TabsTrigger>
                        </TabsList>

                        <TabsContent value="materials" className="mt-4">
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between pb-2">
                                    <div>
                                        <CardTitle className="text-lg">Parts & Materials</CardTitle>
                                        <CardDescription>Items booked out against this repair order.</CardDescription>
                                    </div>
                                    <Button size="sm" variant="outline"><Plus className="w-4 h-4 mr-2" /> Add Part</Button>
                                </CardHeader>
                                <CardContent>
                                    <div className="border rounded-md divide-y">
                                        {MOCK_JOB.parts.map((part) => (
                                            <div key={part.id} className="flex items-center justify-between p-3 hover:bg-slate-50 transition-colors">
                                                <div>
                                                    <p className="font-medium text-sm">{part.description}</p>
                                                    <p className="text-xs text-slate-500 font-mono">SKU: {part.part_number} • Qty: {part.quantity}</p>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <span className="font-semibold text-sm">${(part.quantity * part.unit_price).toFixed(2)}</span>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="labor" className="mt-4">
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between pb-2">
                                    <div>
                                        <CardTitle className="text-lg">Labor Lines</CardTitle>
                                        <CardDescription>Mechanic time logged against this job.</CardDescription>
                                    </div>
                                    <Button size="sm" variant="outline"><Plus className="w-4 h-4 mr-2" /> Add Time</Button>
                                </CardHeader>
                                <CardContent>
                                    <div className="border rounded-md divide-y">
                                        {MOCK_JOB.labor.map((labor) => (
                                            <div key={labor.id} className="flex items-center justify-between p-3 hover:bg-slate-50 transition-colors">
                                                <div>
                                                    <p className="font-medium text-sm">{labor.description}</p>
                                                    <p className="text-xs text-slate-500">{labor.hours} hours @ ${labor.hourly_rate}/hr</p>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <span className="font-semibold text-sm">${(labor.hours * labor.hourly_rate).toFixed(2)}</span>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="notes" className="mt-4">
                            <Card>
                                <CardContent className="pt-6 space-y-4">
                                    <div className="space-y-2">
                                        <Label>Customer Complaint / Notes</Label>
                                        <Textarea readOnly value={MOCK_JOB.customer_notes} className="bg-slate-50 min-h-[100px]" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Mechanic Findings (Internal)</Label>
                                        <Textarea defaultValue={MOCK_JOB.mechanic_notes} className="min-h-[150px]" placeholder="Record your findings here..." />
                                    </div>
                                    <Button>Save Notes</Button>
                                </CardContent>
                            </Card>
                        </TabsContent>

                    </Tabs>
                </div>

                {/* Sidebar Info Panel */}
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Vehicle Context</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label className="text-xs text-slate-500">Registration</Label>
                                <div className="font-semibold text-lg">{MOCK_JOB.registration_number}</div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label className="text-xs text-slate-500">Make</Label>
                                    <div className="font-medium">{MOCK_JOB.vehicle_make}</div>
                                </div>
                                <div>
                                    <Label className="text-xs text-slate-500">Model</Label>
                                    <div className="font-medium">{MOCK_JOB.vehicle_model}</div>
                                </div>
                            </div>
                            <div>
                                <Label className="text-xs text-slate-500">Current Mileage</Label>
                                <div className="font-medium">{MOCK_JOB.mileage}</div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-slate-900 border-slate-800 text-white">
                        <CardHeader className="pb-4">
                            <CardTitle className="text-lg text-slate-200">Financial Summary</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2 text-sm text-slate-400">
                                <div className="flex justify-between">
                                    <span>Parts Total</span>
                                    <span>$109.50</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Labor Total</span>
                                    <span>$240.00</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Tax (Estimated)</span>
                                    <span>$52.42</span>
                                </div>
                                <div className="border-t border-slate-700 pt-2 mt-2 flex justify-between font-bold text-white text-xl">
                                    <span>Priced Total</span>
                                    <span>${(calculateTotal() * 1.15).toFixed(2)}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
