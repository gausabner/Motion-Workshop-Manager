"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { CheckCircle2, ChevronRight, Calendar } from "lucide-react";

const publicBookingSchema = z.object({
    customerName: z.string().min(2, "Please enter your full name"),
    customerEmail: z.string().email("Valid email is required"),
    customerPhone: z.string().min(8, "Phone number is required"),

    vehicleMake: z.string().min(2, "Vehicle make is required"),
    vehicleModel: z.string().min(2, "Vehicle model is required"),
    registrationNumber: z.string().optional(),

    scheduledDate: z.string().min(10, "Please select a date"),
    serviceType: z.string().min(2, "Please tell us what you need"),
});

type PublicBookingValues = z.infer<typeof publicBookingSchema>;

export function PublicBookingWidget({ tenantName }: { tenantName: string }) {
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [isSubmitted, setIsSubmitted] = useState(false);

    const form = useForm<PublicBookingValues>({
        resolver: zodResolver(publicBookingSchema),
        defaultValues: {
            scheduledDate: format(new Date(), "yyyy-MM-dd"),
        },
    });

    const onSubmit = (data: PublicBookingValues) => {
        console.log("Customer submitted web booking:", data);
        // TODO: Send to unauthenticated public API endpoint
        setIsSubmitted(true);
    };

    const nextStep = async (fieldsToValidate: (keyof PublicBookingValues)[]) => {
        const isValid = await form.trigger(fieldsToValidate);
        if (isValid) setStep((prev) => (prev + 1) as 1 | 2 | 3);
    };

    if (isSubmitted) {
        return (
            <Card className="w-full max-w-lg mx-auto border-none shadow-xl">
                <CardContent className="pt-10 pb-10 flex flex-col items-center text-center">
                    <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
                    <h2 className="text-2xl font-bold mb-2">Request Sent!</h2>
                    <p className="text-slate-500 mb-6">
                        Thanks for booking with {tenantName}. We&apos;ve received your request and will be in touch shortly to confirm your appointment time.
                    </p>
                    <Button onClick={() => window.location.reload()} variant="outline">Book Another Vehicle</Button>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="w-full max-w-lg mx-auto shadow-lg border-slate-200">
            <CardHeader className="bg-slate-50 border-b pb-6">
                <CardTitle className="text-2xl">Book a Service</CardTitle>
                <CardDescription>
                    Request an appointment at {tenantName}
                </CardDescription>

                {/* Progress Bar */}
                <div className="flex items-center justify-between pt-4">
                    <div className={`h-2 flex-1 rounded-l-full ${step >= 1 ? 'bg-blue-600' : 'bg-slate-200'}`} />
                    <div className={`h-2 flex-1 mx-1 ${step >= 2 ? 'bg-blue-600' : 'bg-slate-200'}`} />
                    <div className={`h-2 flex-1 rounded-r-full ${step >= 3 ? 'bg-blue-600' : 'bg-slate-200'}`} />
                </div>
            </CardHeader>

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <CardContent className="pt-6 pb-2 min-h-[320px]">
                        {step === 1 && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                                <h3 className="text-lg font-medium">1. Your Details</h3>
                                <FormField control={form.control} name="customerName" render={({ field }) => (
                                    <FormItem><FormLabel>Full Name *</FormLabel><FormControl><Input placeholder="Jane Doe" {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={form.control} name="customerEmail" render={({ field }) => (
                                    <FormItem><FormLabel>Email Address *</FormLabel><FormControl><Input type="email" placeholder="jane@example.com" {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={form.control} name="customerPhone" render={({ field }) => (
                                    <FormItem><FormLabel>Phone Number *</FormLabel><FormControl><Input placeholder="0412 345 678" {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                            </div>
                        )}

                        {step === 2 && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                                <h3 className="text-lg font-medium">2. Vehicle Information</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField control={form.control} name="vehicleMake" render={({ field }) => (
                                        <FormItem><FormLabel>Make *</FormLabel><FormControl><Input placeholder="Toyota" {...field} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                    <FormField control={form.control} name="vehicleModel" render={({ field }) => (
                                        <FormItem><FormLabel>Model *</FormLabel><FormControl><Input placeholder="Corolla" {...field} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                </div>
                                <FormField control={form.control} name="registrationNumber" render={({ field }) => (
                                    <FormItem><FormLabel>Registration Number</FormLabel><FormControl><Input placeholder="XYZ-123" {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                            </div>
                        )}

                        {step === 3 && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                                <h3 className="text-lg font-medium">3. Service Request</h3>
                                <FormField control={form.control} name="serviceType" render={({ field }) => (
                                    <FormItem><FormLabel>What do you need done? *</FormLabel><FormControl><Input placeholder="e.g. Logbook service, brakes squeaking..." {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={form.control} name="scheduledDate" render={({ field }) => (
                                    <FormItem><FormLabel>Preferred Date *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <div className="bg-blue-50 text-blue-800 p-3 rounded-md text-sm mt-4">
                                    <Calendar className="inline-block w-4 h-4 mr-2 mb-1" />
                                    We will contact you to confirm the exact drop-off time for this date.
                                </div>
                            </div>
                        )}
                    </CardContent>

                    <CardFooter className="flex justify-between bg-slate-50 border-t p-4">
                        {step > 1 ? (
                            <Button type="button" variant="outline" onClick={() => setStep((prev) => prev - 1 as 1 | 2 | 3)}>
                                Back
                            </Button>
                        ) : (
                            <div></div> // Empty div for flex spacing
                        )}

                        {step < 3 ? (
                            <Button
                                type="button"
                                onClick={() => {
                                    if (step === 1) nextStep(["customerName", "customerEmail", "customerPhone"]);
                                    if (step === 2) nextStep(["vehicleMake", "vehicleModel"]);
                                }}
                            >
                                Next <ChevronRight className="w-4 h-4 ml-1" />
                            </Button>
                        ) : (
                            <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                                Request Appointment
                            </Button>
                        )}
                    </CardFooter>
                </form>
            </Form>
        </Card>
    );
}
