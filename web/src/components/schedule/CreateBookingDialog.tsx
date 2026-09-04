"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { CalendarIcon, Plus } from "lucide-react";

// The form schema matching the Backend Booking model
const bookingFormSchema = z.object({
    customerName: z.string().min(2, "Name required"),
    customerEmail: z.string().email("Valid email required"),
    customerPhone: z.string().optional(),

    vehicleMake: z.string().min(2, "Make required"),
    vehicleModel: z.string().min(2, "Model required"),
    vehicleYear: z.string().length(4, "Must be Year (YYYY)").optional(),
    registrationNumber: z.string().optional(),

    scheduledDate: z.string().min(10, "Required"), // YYYY-MM-DD
    scheduledTime: z.string().min(5, "Required"),  // HH:MM
    dueByDate: z.string().optional(),

    serviceType: z.string().min(2, "Required"),
    description: z.string().optional(),
    eventNotes: z.string().optional(),
    jobCardNotes: z.string().optional(),
    assignedToId: z.string().optional(),
    reference: z.string().optional(),
    customerOrderNumber: z.string().optional(),
});

type BookingFormValues = z.infer<typeof bookingFormSchema>;

export function CreateBookingDialog({ children }: { children: React.ReactNode }) {
    const [open, setOpen] = useState(false);

    const form = useForm<BookingFormValues>({
        resolver: zodResolver(bookingFormSchema),
        defaultValues: {
            scheduledDate: format(new Date(), "yyyy-MM-dd"),
            scheduledTime: "09:00",
        },
    });

    const onSubmit = (data: BookingFormValues) => {
        console.log("Submitting Booking:", data);
        // TODO: Send to backend
        setOpen(false);
        form.reset();
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {children}
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
                <DialogHeader>
                    <DialogTitle>Create New Booking</DialogTitle>
                    <DialogDescription>
                        Schedule a service appointment. Provide customer and vehicle details.
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
                        {/* Customer Section */}
                        <div>
                            <h4 className="text-sm font-medium mb-3 border-b pb-1">Customer Details</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField control={form.control} name="customerName" render={({ field }) => (
                                    <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={form.control} name="customerEmail" render={({ field }) => (
                                    <FormItem><FormLabel>Email Address</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={form.control} name="customerPhone" render={({ field }) => (
                                    <FormItem><FormLabel>Phone Number (Optional)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                            </div>
                        </div>

                        {/* Vehicle Section */}
                        <div>
                            <h4 className="text-sm font-medium mb-3 border-b pb-1">Vehicle Details</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField control={form.control} name="vehicleMake" render={({ field }) => (
                                    <FormItem><FormLabel>Make</FormLabel><FormControl><Input placeholder="Toyota, Ford..." {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={form.control} name="vehicleModel" render={({ field }) => (
                                    <FormItem><FormLabel>Model</FormLabel><FormControl><Input placeholder="Hilux, Ranger..." {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={form.control} name="vehicleYear" render={({ field }) => (
                                    <FormItem><FormLabel>Year</FormLabel><FormControl><Input placeholder="2022" {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={form.control} name="registrationNumber" render={({ field }) => (
                                    <FormItem><FormLabel>Registration Number</FormLabel><FormControl><Input placeholder="ABC-123" {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                            </div>
                        </div>

                        {/* Scheduling Section */}
                        <div>
                            <h4 className="text-sm font-medium mb-3 border-b pb-1">Scheduling</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField control={form.control} name="scheduledDate" render={({ field }) => (
                                    <FormItem><FormLabel>Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={form.control} name="scheduledTime" render={({ field }) => (
                                    <FormItem><FormLabel>Time</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={form.control} name="serviceType" render={({ field }) => (
                                    <FormItem className="md:col-span-2"><FormLabel>Service Required</FormLabel><FormControl><Input placeholder="e.g. Major Service, Brake replacement" {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-4">
                            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                            <Button type="submit">Create Booking</Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
