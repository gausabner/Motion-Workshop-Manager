"use client";

import { useState } from "react";
import { format, addDays, startOfWeek, addHours, startOfDay } from "date-fns";
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, Clock, User, Car } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// Mock Data representing backend Bookings
const MOCK_BOOKINGS = [
    {
        id: "b1",
        customer_name: "Sarah Connor",
        vehicle_make: "Toyota",
        vehicle_model: "Hilux",
        registration_number: "T800-SKY",
        scheduled_date: new Date(new Date().setHours(9, 0, 0, 0)),
        duration_minutes: 120, // 2 hours
        service_type: "Logbook Service",
        status: "CONFIRMED",
        mechanic: "Mike Engine",
    },
    {
        id: "b2",
        customer_name: "John Wick",
        vehicle_make: "Ford",
        vehicle_model: "Mustang",
        registration_number: "JW-1969",
        scheduled_date: new Date(new Date().setHours(13, 30, 0, 0)),
        duration_minutes: 90,
        service_type: "Brake Pad Replacement",
        status: "PENDING",
        mechanic: "Unassigned",
    }
];

import { CreateBookingDialog } from "./CreateBookingDialog";

export function ScheduleView() {
    const [currentDate, setCurrentDate] = useState(new Date());

    // Create a timeline from 8 AM to 6 PM
    const hours = Array.from({ length: 11 }, (_, i) => i + 8);

    const getStatusColor = (status: string) => {
        switch (status) {
            case "CONFIRMED": return "bg-blue-100 text-blue-800 border-blue-200";
            case "PENDING": return "bg-orange-100 text-orange-800 border-orange-200";
            case "COMPLETED": return "bg-green-100 text-green-800 border-green-200";
            default: return "bg-slate-100 text-slate-800 border-slate-200";
        }
    };

    return (
        <div className="flex h-[calc(100vh-120px)] flex-col space-y-4">
            {/* Header Toolbar */}
            <div className="flex items-center justify-between bg-white p-4 rounded-xl border shadow-sm">
                <div className="flex items-center space-x-4">
                    <h2 className="text-xl font-bold">{format(currentDate, "MMMM yyyy")}</h2>
                    <div className="flex items-center space-x-2 bg-slate-100 p-1 rounded-lg">
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md" onClick={() => setCurrentDate(addDays(currentDate, -1))}>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-sm font-medium w-32 text-center">
                            {format(currentDate, "EEEE, MMM d")}
                        </span>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md" onClick={() => setCurrentDate(addDays(currentDate, 1))}>
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>Today</Button>
                </div>

                <div className="flex items-center space-x-3">
                    <div className="text-sm text-slate-500 mr-4">
                        <span className="font-semibold text-slate-900">{MOCK_BOOKINGS.length}</span> Bookings today
                    </div>
                    <CreateBookingDialog>
                        <Button className="font-medium bg-blue-600 hover:bg-blue-700">
                            <Plus className="h-4 w-4 mr-2" /> New Booking
                        </Button>
                    </CreateBookingDialog>
                </div>
            </div>

            {/* Daily Grid Wrapper */}
            <Card className="flex-1 overflow-hidden flex flex-col bg-white">
                <div className="flex flex-1 overflow-auto relative">

                    {/* Time Column (Y axis) */}
                    <div className="w-20 border-r bg-slate-50/50 flex flex-col sticky left-0 z-20">
                        {hours.map((hour) => (
                            <div key={hour} className="h-24 border-b relative">
                                <span className="absolute -top-3 right-3 text-xs font-medium text-slate-500 bg-white px-1">
                                    {format(new Date().setHours(hour, 0), "h a")}
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Schedule Canvas */}
                    <div className="flex-1 relative min-w-[800px]">
                        {/* Grid Lines */}
                        {hours.map((hour) => (
                            <div key={hour} className="h-24 border-b border-slate-100 w-full" />
                        ))}

                        {/* Bookings Render */}
                        {MOCK_BOOKINGS.filter(b => b.scheduled_date.getDate() === currentDate.getDate()).map((booking) => {
                            // Calculate positioning
                            const hourDecimal = booking.scheduled_date.getHours() + (booking.scheduled_date.getMinutes() / 60);
                            const topOffset = (hourDecimal - 8) * 96; // 96px is h-24
                            const heightBase = (booking.duration_minutes / 60) * 96;

                            return (
                                <div
                                    key={booking.id}
                                    className={`absolute left-4 right-4 rounded-lg border p-3 shadow-sm hover:shadow-md transition-all cursor-pointer overflow-hidden ${getStatusColor(booking.status)}`}
                                    style={{ top: `${topOffset}px`, height: `${heightBase - 4}px` }}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <div className="font-bold flex items-center text-sm truncate">
                                            {booking.customer_name}
                                        </div>
                                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 border-current bg-white/50`}>
                                            {booking.status}
                                        </Badge>
                                    </div>

                                    <div className="flex items-center text-xs opacity-90 truncate mb-1 font-medium">
                                        <Car className="h-3.5 w-3.5 mr-1" />
                                        {booking.vehicle_make} {booking.vehicle_model} ({booking.registration_number})
                                    </div>

                                    <div className="flex justify-between">
                                        <div className="flex items-center text-xs opacity-80 truncate">
                                            <Clock className="h-3 w-3 mr-1" />
                                            {format(booking.scheduled_date, "h:mm a")} - {booking.duration_minutes}m
                                        </div>

                                        <div className="flex items-center text-xs opacity-80 truncate">
                                            <User className="h-3 w-3 mr-1" />
                                            {booking.mechanic}
                                        </div>
                                    </div>

                                    <div className="text-xs font-semibold mt-1 opacity-95 truncate">
                                        {booking.service_type}
                                    </div>
                                </div>
                            );
                        })}

                        {/* Current Time Indicator line (would be calculated dynamically) */}
                        {currentDate.getDate() === new Date().getDate() && (
                            <div
                                className="absolute left-0 right-0 border-t-2 border-red-500 z-10 pointer-events-none"
                                style={{
                                    top: `${(new Date().getHours() + (new Date().getMinutes() / 60) - 8) * 96}px`
                                }}
                            >
                                <div className="absolute -top-1.5 -left-1.5 h-3 w-3 rounded-full bg-red-500" />
                            </div>
                        )}

                    </div>
                </div>
            </Card>
        </div>
    );
}
