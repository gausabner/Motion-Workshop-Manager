"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, AlertTriangle, AlertOctagon, Camera, Send, Plus, ArrowLeft, Wrench } from "lucide-react";
import Link from "next/link";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Mock Data representing a Backend Inspection
const MOCK_INSPECTION = {
    id: "insp_1",
    job_id: "jc_1",
    vehicle_make: "Toyota",
    vehicle_model: "Hilux",
    registration_number: "T800-SKY",
    status: "DRAFT",
    mechanic_name: "Mike Engine",
    date: new Date().toLocaleDateString(),

    items: [
        { id: "i1", category: "Brakes", description: "Front Brake Pads", condition: "AMBER", notes: "Down to 3mm. Require replacing soon." },
        { id: "i2", category: "Brakes", description: "Rear Brake Drums", condition: "GREEN", notes: "Good condition. Cleaned and adjusted." },
        { id: "i3", category: "Tires", description: "Front Left Tire", condition: "RED", notes: "Puncture on sidewall. Unsafe. Needs immediate replacement." },
        { id: "i4", category: "Fluids", description: "Engine Oil Level", condition: "GREEN", notes: "Topped up." },
        { id: "i5", category: "Suspension", description: "Front Shock Absorbers", condition: "GREEN", notes: "No leaks visible." },
    ]
};

const CATEGORIES = ["Exterior", "Interior", "Under Hood", "Under Vehicle", "Brakes", "Tires", "Suspension", "Fluids", "Electrical"];

export function InspectionChecklist({ inspectionId, tenant }: { inspectionId: string, tenant: string }) {
    const [items, setItems] = useState(MOCK_INSPECTION.items);
    const [status, setStatus] = useState(MOCK_INSPECTION.status);

    // Group items by category for rendering
    const groupedItems = items.reduce((acc, item) => {
        if (!acc[item.category]) acc[item.category] = [];
        acc[item.category].push(item);
        return acc;
    }, {} as Record<string, typeof items>);

    const updateCondition = (id: string, condition: "GREEN" | "AMBER" | "RED") => {
        setItems(items.map(item => item.id === id ? { ...item, condition } : item));
    };

    const calculateHealthScore = () => {
        const total = items.length;
        if (total === 0) return 0;
        const green = items.filter(i => i.condition === "GREEN").length;
        return Math.round((green / total) * 100);
    };

    const healthScore = calculateHealthScore();

    const getBadgeColor = (condition: string) => {
        switch (condition) {
            case 'RED': return 'bg-red-100 text-red-800 border-red-200';
            case 'AMBER': return 'bg-amber-100 text-amber-800 border-amber-200';
            case 'GREEN': return 'bg-green-100 text-green-800 border-green-200';
            default: return 'bg-slate-100 text-slate-800 border-slate-200';
        }
    };

    return (
        <div className="flex flex-col gap-6 max-w-5xl mx-auto pb-12">
            {/* Header Section */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href={`/${tenant}/dashboard/jobs`}>
                        <Button variant="outline" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
                    </Link>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold tracking-tight">Vehicle Inspection</h1>
                            <Badge variant="outline">{status}</Badge>
                        </div>
                        <p className="text-sm text-slate-500">
                            {MOCK_INSPECTION.vehicle_make} {MOCK_INSPECTION.vehicle_model} ({MOCK_INSPECTION.registration_number}) • Inspector: {MOCK_INSPECTION.mechanic_name}
                        </p>
                    </div>
                </div>

                <div className="flex gap-3">
                    <Button variant="outline"><Plus className="w-4 h-4 mr-2" /> Add Custom Check</Button>
                    <Button className="bg-blue-600 hover:bg-blue-700">
                        <Send className="w-4 h-4 mr-2" /> Send to Customer
                    </Button>
                </div>
            </div>

            {/* Health Overview Card */}
            <Card className="bg-slate-900 text-white border-slate-800 shadow-md">
                <CardContent className="flex items-center justify-between p-6">
                    <div className="space-y-1">
                        <h3 className="text-lg font-medium text-slate-200">Overall Health Score</h3>
                        <p className="text-sm text-slate-400">Based on {items.length} inspection checkpoints</p>
                    </div>
                    <div className="flex items-center gap-8">
                        <div className="flex gap-4 text-center">
                            <div>
                                <div className="text-2xl font-bold text-red-400">{items.filter(i => i.condition === 'RED').length}</div>
                                <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Action Required</div>
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-amber-400">{items.filter(i => i.condition === 'AMBER').length}</div>
                                <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Monitor</div>
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-green-400">{items.filter(i => i.condition === 'GREEN').length}</div>
                                <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Good</div>
                            </div>
                        </div>
                        <div className="h-16 w-px bg-slate-700"></div>
                        <div className="text-right">
                            <div className={`text-4xl font-black ${healthScore > 80 ? 'text-green-400' : healthScore > 50 ? 'text-amber-400' : 'text-red-400'}`}>
                                {healthScore}%
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Categories Iteration */}
            <div className="space-y-6">
                {Object.entries(groupedItems).map(([category, categoryItems]) => (
                    <Card key={category} className="overflow-hidden shadow-sm">
                        <CardHeader className="bg-slate-50 border-b py-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Wrench className="w-4 h-4 text-slate-500" /> {category}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y">
                                {categoryItems.map((item) => (
                                    <div key={item.id} className="flex flex-col md:flex-row p-4 gap-4 md:items-start transition-colors hover:bg-slate-50/50">

                                        {/* Action Buttons (Traffic Light) */}
                                        <div className="flex shrink-0 gap-1 border rounded-lg p-1 bg-slate-50 h-10">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className={`h-full w-10 rounded-md ${item.condition === 'GREEN' ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'text-slate-400 hover:text-green-600'}`}
                                                onClick={() => updateCondition(item.id, 'GREEN')}
                                                title="Good Condition"
                                            >
                                                <CheckCircle2 className="w-5 h-5" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className={`h-full w-10 rounded-md ${item.condition === 'AMBER' ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'text-slate-400 hover:text-amber-600'}`}
                                                onClick={() => updateCondition(item.id, 'AMBER')}
                                                title="Monitor / Future Repair"
                                            >
                                                <AlertTriangle className="w-5 h-5" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className={`h-full w-10 rounded-md ${item.condition === 'RED' ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'text-slate-400 hover:text-red-600'}`}
                                                onClick={() => updateCondition(item.id, 'RED')}
                                                title="Immediate Action Required"
                                            >
                                                <AlertOctagon className="w-5 h-5" />
                                            </Button>
                                        </div>

                                        {/* Description and Notes */}
                                        <div className="flex-1 space-y-2">
                                            <div className="flex justify-between">
                                                <Label className="text-base font-semibold">{item.description}</Label>
                                                <Badge variant="outline" className={`ml-2 text-[10px] ${getBadgeColor(item.condition)}`}>
                                                    {item.condition}
                                                </Badge>
                                            </div>
                                            <Input
                                                defaultValue={item.notes}
                                                placeholder="Add specific mechanic notes or measurements (e.g., 'Tread depth 3mm')..."
                                                className="text-sm bg-white"
                                            />
                                        </div>

                                        {/* Photo Upload Placeholder */}
                                        <div className="shrink-0 flex items-center justify-center w-16 h-16 rounded-md border-2 border-dashed border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-blue-500 cursor-pointer transition-colors bg-white">
                                            <Camera className="w-6 h-6" />
                                        </div>

                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

        </div>
    );
}
