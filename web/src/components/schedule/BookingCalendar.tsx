"use client";

import { useState } from "react";
import Link from "next/link";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Star, Plus, AlertTriangle } from "lucide-react";

type ViewMode = 'month' | 'week' | 'day';

// Mock Data Generator for Month View
const generateMockCalendarDays = () => {
    const days = [];
    for (let i = 26; i <= 31; i++) days.push({ day: i, isCurrentMonth: false, hasMarkers: false, isSelected: false });
    for (let i = 1; i <= 28; i++) {
        const hasMarkers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28].includes(i);
        days.push({ day: i, isCurrentMonth: true, hasMarkers, isSelected: i === 21 });
    }
    for (let i = 1; i <= 8; i++) days.push({ day: i, isCurrentMonth: false, hasMarkers: false, isSelected: false });
    return days;
};

// --- Sub-Components ---

function MonthView({ onDayClick }: { onDayClick: () => void }) {
    const calendarDays = generateMockCalendarDays();
    return (
        <div className="flex-1 px-4 mb-2">
            <div className="w-full h-full border border-slate-300 flex flex-col rounded-sm overflow-hidden">
                <div className="grid grid-cols-7 border-b border-slate-300 bg-white">
                    {['Mon 26/1', 'Tue 27/1', 'Wed 28/1', 'Thu 29/1', 'Fri 30/1', 'Sat 31/1', 'Sun 1/2'].map((dayStr, i) => (
                        <div key={i} className="py-2 text-center text-xs font-bold text-slate-900 border-r last:border-r-0 border-slate-300">
                            {dayStr}
                        </div>
                    ))}
                </div>
                <div className="flex-1 grid grid-cols-7 grid-rows-5 bg-white">
                    {calendarDays.slice(0, 35).map((dateData, index) => (
                        <div
                            key={index}
                            onClick={onDayClick}
                            className={`relative border-r border-b border-slate-200 p-2 flex flex-col justify-between cursor-pointer hover:bg-slate-50 transition-colors ${index % 7 === 6 ? 'border-r-0' : ''} ${dateData.isSelected ? 'bg-[#fff9e6]' : 'bg-white'}`}
                        >
                            <div className="flex justify-between items-start">
                                <div className="flex gap-1 mt-0.5">
                                    {dateData.hasMarkers && (
                                        <>
                                            <div className="w-2 h-2 rounded-full bg-[#8bc34a]"></div>
                                            <div className="w-2 h-2 rounded-full bg-[#f44336]"></div>
                                        </>
                                    )}
                                </div>
                                <div className={`text-xs font-medium ${dateData.isCurrentMonth ? 'text-slate-800' : 'text-slate-300'}`}>{dateData.day}</div>
                            </div>
                            <div className="flex gap-1 pb-1">
                                {dateData.hasMarkers && (
                                    <>
                                        <div className="w-4 h-4 rounded-full border border-slate-300 bg-white"></div>
                                        <div className="w-4 h-4 rounded-full border border-slate-300 bg-white"></div>
                                        <div className="w-4 h-4 rounded-full border border-slate-300 bg-white"></div>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function WeekView() {
    const hours = ['8am', '9am', '10am', '11am', '12pm', '1pm', '2pm', '3pm', '4pm', '5pm', '6pm'];
    const days = ['Mon 16/2', 'Tue 17/2', 'Wed 18/2', 'Thu 19/2', 'Fri 20/2', 'Sat 21/2', 'Sun 22/2'];

    return (
        <div className="flex-1 px-4 mb-2 overflow-auto">
            <div className="w-full min-h-[800px] border border-slate-300 flex flex-col rounded-sm bg-white">
                {/* Header Row */}
                <div className="flex border-b border-slate-300">
                    <div className="w-16 border-r border-slate-300 shrink-0 bg-white"></div>
                    {days.map((day, i) => (
                        <div key={i} className="flex-1 py-2 text-center text-xs font-bold text-slate-900 border-r last:border-r-0 border-slate-300 bg-white">
                            {day}
                        </div>
                    ))}
                </div>
                {/* Time Rows */}
                <div className="flex flex-col flex-1">
                    {hours.map((hour, i) => (
                        <div key={i} className="flex flex-1 min-h-[60px] border-b last:border-b-0 border-slate-200">
                            <div className="w-16 border-r border-slate-300 flex items-start justify-center pt-1 text-xs text-slate-600 bg-white shrink-0">
                                {hour}
                            </div>
                            {days.map((_, j) => (
                                <div key={j} className="flex-1 border-r last:border-r-0 border-slate-200 bg-white"></div>
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function DayView() {
    const [dayMode, setDayMode] = useState<'calendar' | 'list'>('calendar');

    const MOCK_BOOKINGS = [
        {
            id: "b1",
            time: "09:00 AM",
            customer: "Sarah Connor",
            vehicle: "Toyota Hilux (T800-SKY)",
            service: "Logbook Service",
            status: "CONFIRMED",
            mechanic: "Mike Engine",
        },
        {
            id: "b2",
            time: "01:30 PM",
            customer: "John Wick",
            vehicle: "Ford Mustang (JW-1969)",
            service: "Brake Pad Replacement",
            status: "PENDING",
            mechanic: "Unassigned",
        }
    ];

    const timeSlots = [
        '7:30am', '8am', '8:30am', '9am', '9:30am', '10am', '10:30am', '11am',
        '11:30am', '12pm', '12:30pm', '1pm', '1:30pm', '2pm', '2:30pm', '3pm',
        '3:30pm', '4pm', '4:30pm', '5pm', '5:30pm', '6pm'
    ];

    return (
        <div className="flex-1 px-4 mb-2 overflow-auto flex flex-col">
            {/* Top toggle unique to Day view */}
            <div className="flex justify-end mb-2 mr-1">
                <div className="flex rounded-sm border border-slate-300 overflow-hidden shadow-sm text-xs">
                    <button
                        onClick={() => setDayMode('calendar')}
                        className={`px-3 py-1 font-medium border-r border-slate-300 ${dayMode === 'calendar' ? 'bg-slate-200 text-slate-700' : 'bg-white hover:bg-slate-50 text-slate-600'}`}>
                        Calendar
                    </button>
                    <button
                        onClick={() => setDayMode('list')}
                        className={`px-3 py-1 ${dayMode === 'list' ? 'bg-slate-200 text-slate-700 font-medium' : 'bg-white hover:bg-slate-50 text-slate-600'}`}>
                        List
                    </button>
                </div>
            </div>

            {dayMode === 'calendar' ? (
                <div className="w-full border border-slate-300 flex flex-col rounded-sm bg-white">
                    {timeSlots.map((time, i) => (
                        <div key={i} className="flex min-h-[40px] border-b last:border-b-0 border-slate-200">
                            <div className="w-[80px] border-r border-slate-300 flex items-center justify-center text-xs text-slate-600 bg-white shrink-0">
                                {time}
                            </div>
                            <div className="flex-1 bg-white"></div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="w-full border border-slate-300 rounded-sm bg-white overflow-hidden shadow-sm flex-1">
                    <table className="w-full text-sm text-left border-collapse">
                        <thead className="bg-[#f5f5f5] border-b border-slate-300 text-slate-700 text-xs font-bold uppercase tracking-wider">
                            <tr>
                                <th className="px-4 py-3 w-32 border-r border-slate-200">Time</th>
                                <th className="px-4 py-3 border-r border-slate-200">Customer</th>
                                <th className="px-4 py-3 border-r border-slate-200">Vehicle</th>
                                <th className="px-4 py-3 border-r border-slate-200">Service</th>
                                <th className="px-4 py-3 border-r border-slate-200">Mechanic</th>
                                <th className="px-4 py-3 text-right">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {MOCK_BOOKINGS.map((booking) => (
                                <tr key={booking.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-4 py-3 font-semibold text-slate-900 border-r border-slate-100">{booking.time}</td>
                                    <td className="px-4 py-3 font-medium border-r border-slate-100">{booking.customer}</td>
                                    <td className="px-4 py-3 text-slate-600 border-r border-slate-100">{booking.vehicle}</td>
                                    <td className="px-4 py-3 text-slate-600 border-r border-slate-100">{booking.service}</td>
                                    <td className="px-4 py-3 text-slate-600 border-r border-slate-100">{booking.mechanic}</td>
                                    <td className="px-4 py-3 text-right">
                                        <span className={`px-2 py-1 rounded-sm text-xs font-bold tracking-wide ${booking.status === 'CONFIRMED' ? 'bg-[#e1f5fe] text-[#0288d1] border border-[#b3e5fc]' : 'bg-[#fff3e0] text-[#f57c00] border border-[#ffe0b2]'}`}>
                                            {booking.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

// --- Main Component ---

export function BookingCalendar() {
    const [viewMode, setViewMode] = useState<ViewMode>('month');

    const getSubHeaderTitle = () => {
        switch (viewMode) {
            case 'week': return 'Feb 16 — 22, 2026';
            case 'day': return 'February 21, 2026';
            case 'month':
            default: return 'February 2026';
        }
    };

    return (
        <div className="flex flex-col h-full w-full max-w-7xl mx-auto space-y-4">
            {/* Pending Requests Banner */}
            <div className="flex items-center gap-2 bg-[#eef8ed] border border-[#d3ecd1] text-[#2e7d32] p-3 rounded-sm text-sm font-medium shadow-sm">
                <AlertTriangle className="w-4 h-4" />
                <span>There are currently 0 booking requests pending approval.</span>
            </div>

            {/* Main Calendar Card */}
            <div className="bg-white border text-smborder-slate-300 rounded-sm shadow-sm flex flex-col flex-1 pb-4">

                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-300 bg-[#f5f5f5] px-4 py-2.5">
                    <div className="flex items-center gap-2">
                        <CalendarIcon className="w-5 h-5 text-slate-500" />
                        <h2 className="text-lg font-bold text-slate-800">Booking Calendar</h2>
                    </div>
                    <div className="flex items-center gap-4 text-slate-600">
                        {viewMode === 'month' ? (
                            <div className="flex items-center text-sm font-medium">
                                <ChevronLeft className="w-4 h-4 cursor-pointer hover:text-slate-900" />
                                <span className="mx-2">Mechanic 1, Edit Me – Mechanic 3, Edit Me</span>
                                <ChevronRight className="w-4 h-4 cursor-pointer hover:text-slate-900" />
                            </div>
                        ) : (
                            <div className="flex items-center text-sm font-medium">
                                <ChevronLeft className="w-4 h-4 cursor-pointer hover:text-slate-900" />
                                <span className="mx-2">N/A</span>
                                <ChevronRight className="w-4 h-4 cursor-pointer hover:text-slate-900" />
                            </div>
                        )}
                        <Star className="w-5 h-5 cursor-pointer hover:text-slate-900" />
                        <Link href="/demo-tenant/dashboard/schedule/bookings/new">
                            <Plus className="w-5 h-5 cursor-pointer hover:text-slate-900" />
                        </Link>
                    </div>
                </div>

                {/* Sub Header (Date & Controls) */}
                <div className="flex items-center justify-between px-4 py-3">
                    <div className="text-base text-slate-800 tracking-wide">
                        {getSubHeaderTitle()}
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Toggle Group */}
                        <div className="flex rounded-sm w-fit border border-slate-300 overflow-hidden shadow-sm h-8">
                            <button
                                onClick={() => setViewMode('month')}
                                className={`px-3 py-1 text-sm border-r border-slate-300 ${viewMode === 'month' ? 'bg-slate-200 font-medium text-slate-700' : 'bg-white hover:bg-slate-50 text-slate-600'}`}
                            >
                                month
                            </button>
                            <button
                                onClick={() => setViewMode('week')}
                                className={`px-3 py-1 text-sm border-r border-slate-300 ${viewMode === 'week' ? 'bg-slate-200 font-medium text-slate-700' : 'bg-white hover:bg-slate-50 text-slate-600'}`}
                            >
                                week
                            </button>
                            <button
                                onClick={() => setViewMode('day')}
                                className={`px-3 py-1 text-sm ${viewMode === 'day' ? 'bg-slate-200 font-medium text-slate-700' : 'bg-white hover:bg-slate-50 text-slate-600'}`}
                            >
                                day
                            </button>
                        </div>

                        <button
                            onClick={() => setViewMode('day')}
                            className="bg-white border border-slate-300 hover:bg-slate-50 px-3 h-8 text-sm text-slate-600 rounded-sm shadow-sm">
                            Today
                        </button>

                        <div className="flex rounded-sm w-fit border border-slate-300 overflow-hidden shadow-sm h-8">
                            <button className="bg-white hover:bg-slate-50 px-2 flex items-center justify-center border-r border-slate-300">
                                <ChevronLeft className="w-4 h-4 text-slate-600" />
                            </button>
                            <button className="bg-white hover:bg-slate-50 px-2 flex items-center justify-center">
                                <ChevronRight className="w-4 h-4 text-slate-600" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Dynamic View Render */}
                {viewMode === 'month' && <MonthView onDayClick={() => setViewMode('day')} />}
                {viewMode === 'week' && <WeekView />}
                {viewMode === 'day' && <DayView />}

            </div>
        </div>
    );
}
