"use client";

import { useState } from "react";
import { User, Car, X, Plus, Calendar, Trash2, Settings, ChevronDown } from "lucide-react";

export default function CreateBookingPage() {
    const [customerSearch, setCustomerSearch] = useState("");
    const [vehicleFilter, setVehicleFilter] = useState("");
    const [freight, setFreight] = useState("0");

    const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);
    const [isCreatingVehicle, setIsCreatingVehicle] = useState(false);

    return (
        <div className="flex flex-col h-full w-full max-w-[1200px] mx-auto space-y-6">

            {/* Top Selection Cards */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

                {/* Select Customer */}
                <div className="bg-white rounded-sm border border-slate-300 shadow-sm flex flex-col min-h-[280px]">
                    <div className="bg-[#f5f5f5] px-4 py-3 border-b border-slate-300 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-slate-700 font-bold">
                            <User className="h-5 w-5 text-slate-400" />
                            Select A Customer
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Search Customers..."
                                    value={customerSearch}
                                    onChange={(e) => setCustomerSearch(e.target.value)}
                                    className="border border-teal-600 rounded-sm pl-2 pr-8 py-1 text-sm outline-none focus:ring-1 focus:ring-teal-600 w-48 text-slate-700"
                                />
                                {customerSearch && (
                                    <X className="h-4 w-4 absolute right-2 top-1.5 text-slate-500 cursor-pointer" onClick={() => setCustomerSearch("")} />
                                )}
                            </div>
                            <button
                                onClick={() => setIsCreatingCustomer(!isCreatingCustomer)}
                                className="text-slate-500 hover:text-slate-800 transition-colors bg-slate-200 hover:bg-slate-300 p-0.5 rounded-sm">
                                <Plus className="h-5 w-5" />
                            </button>
                        </div>
                    </div>

                    {isCreatingCustomer ? (
                        <div className="flex-1 bg-[#ffffcc] p-4 flex flex-col gap-4 border border-yellow-200 m-2 rounded-sm">
                            {/* Type Toggle */}
                            <div className="flex items-center gap-4 mb-2">
                                <div className="flex items-center bg-white rounded-full border border-teal-600 px-3 py-1 cursor-pointer">
                                    <div className="w-3 h-3 rounded-full bg-slate-300 mr-2"></div>
                                    <span className="text-xs font-bold text-teal-600 uppercase tracking-wide">Individual</span>
                                </div>
                                <div className="flex items-center bg-teal-600 rounded-full border border-teal-600 px-3 py-1 cursor-pointer">
                                    <span className="text-xs font-bold text-white uppercase tracking-wide mr-2">Cash</span>
                                    <div className="w-3 h-3 rounded-full bg-white"></div>
                                </div>
                            </div>

                            {/* Form Grid */}
                            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                                <div className="flex flex-col">
                                    <div className="flex justify-between">
                                        <label className="text-xs font-medium text-slate-600 mb-1">First Name</label>
                                        <span className="text-[10px] text-teal-600 opacity-70">required</span>
                                    </div>
                                    <input type="text" className="border border-yellow-300 bg-white rounded-sm px-3 py-1.5 text-sm outline-none w-full shadow-sm" />
                                </div>
                                <div className="flex flex-col">
                                    <div className="flex justify-between">
                                        <label className="text-xs font-medium text-slate-600 mb-1">Last Name</label>
                                        <span className="text-[10px] text-teal-600 opacity-70">required</span>
                                    </div>
                                    <input type="text" className="border border-yellow-300 bg-white rounded-sm px-3 py-1.5 text-sm outline-none w-full shadow-sm" />
                                </div>

                                <div className="flex flex-col">
                                    <label className="text-xs font-medium text-slate-600 mb-1">Phone</label>
                                    <input type="text" className="border border-yellow-300 bg-white rounded-sm px-3 py-1.5 text-sm outline-none w-full shadow-sm" />
                                </div>
                                <div className="flex flex-col">
                                    <label className="text-xs font-medium text-slate-600 mb-1">Mobile</label>
                                    <input type="text" className="border border-yellow-300 bg-white rounded-sm px-3 py-1.5 text-sm outline-none w-full shadow-sm" />
                                </div>

                                <div className="flex flex-col">
                                    <label className="text-xs font-medium text-slate-600 mb-1">Email</label>
                                    <input type="email" className="border border-yellow-300 bg-white rounded-sm px-3 py-1.5 text-sm outline-none w-full shadow-sm" />
                                </div>
                                <div className="flex flex-col">
                                    <label className="text-xs font-medium text-slate-600 mb-1">Address 1</label>
                                    <input type="text" className="border border-yellow-300 bg-white rounded-sm px-3 py-1.5 text-sm outline-none w-full shadow-sm" />
                                </div>

                                <div className="flex flex-col">
                                    <label className="text-xs font-medium text-slate-600 mb-1">Suburb</label>
                                    <input type="text" className="border border-yellow-300 bg-white rounded-sm px-3 py-1.5 text-sm outline-none w-full shadow-sm" />
                                </div>
                                <div className="flex flex-col">
                                    <label className="text-xs font-medium text-slate-600 mb-1">State</label>
                                    <select className="border border-yellow-300 bg-white rounded-sm px-2 py-1.5 text-sm outline-none w-full shadow-sm text-slate-500">
                                        <option>Select A State</option>
                                    </select>
                                </div>

                                <div className="flex flex-col">
                                    <label className="text-xs font-medium text-slate-600 mb-1">Postcode</label>
                                    <input type="text" className="border border-yellow-300 bg-white rounded-sm px-3 py-1.5 text-sm outline-none w-full shadow-sm" />
                                </div>
                                <div className="flex flex-col">
                                    <label className="text-xs font-medium text-slate-600 mb-1">Preferred Method Of Contact</label>
                                    <select className="border border-yellow-300 bg-white rounded-sm px-2 py-1.5 text-sm outline-none w-full shadow-sm">
                                        <option></option>
                                    </select>
                                </div>

                                <div className="flex flex-col">
                                    <label className="text-xs font-medium text-slate-600 mb-1">Customer Source</label>
                                    <select className="border border-yellow-300 bg-white rounded-sm px-2 py-1.5 text-sm outline-none w-full shadow-sm">
                                        <option></option>
                                    </select>
                                </div>
                                <div className="flex flex-col">
                                    <label className="text-xs font-medium text-slate-600 mb-1">Price Type</label>
                                    <select className="border border-yellow-300 bg-[#f5f5f5] rounded-sm px-2 py-1.5 text-sm outline-none w-full shadow-sm">
                                        <option>Retail</option>
                                    </select>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex justify-between items-center mt-2">
                                <button
                                    onClick={() => setIsCreatingCustomer(false)}
                                    className="px-4 py-1.5 bg-white border border-slate-300 text-slate-600 font-medium rounded-sm text-sm hover:bg-slate-50 transition-colors shadow-sm">
                                    Cancel
                                </button>
                                <button className="px-6 py-1.5 bg-[#00897b] text-white font-medium rounded-sm text-sm hover:bg-[#00796b] transition-colors shadow-sm">
                                    Save
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 bg-[#fcfcfc] flex items-center justify-center text-slate-400 text-sm">
                            {/* Empty state for customer details */}
                        </div>
                    )}
                </div>

                {/* Select Vehicle */}
                <div className="bg-white rounded-sm border border-slate-300 shadow-sm flex flex-col min-h-[280px]">
                    <div className="bg-[#f5f5f5] px-4 py-3 border-b border-slate-300 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-slate-700 font-bold">
                            <Car className="h-5 w-5 text-slate-400" />
                            Select A Vehicle (Optional)
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Filter..."
                                    value={vehicleFilter}
                                    onChange={(e) => setVehicleFilter(e.target.value)}
                                    className="border border-slate-300 rounded-sm pl-2 pr-8 py-1 text-sm outline-none w-32 text-slate-700 bg-white"
                                />
                                {vehicleFilter && (
                                    <X className="h-4 w-4 absolute right-2 top-1.5 text-slate-400 cursor-pointer" onClick={() => setVehicleFilter("")} />
                                )}
                            </div>
                            <button
                                onClick={() => setIsCreatingVehicle(!isCreatingVehicle)}
                                className="text-slate-500 hover:text-slate-800 transition-colors bg-slate-200 hover:bg-slate-300 p-0.5 rounded-sm">
                                <Plus className="h-5 w-5" />
                            </button>
                        </div>
                    </div>

                    {isCreatingVehicle ? (
                        <div className="flex-1 bg-white p-4 flex flex-col gap-4 border border-slate-200 m-2 rounded-sm shadow-sm">
                            {/* Form Grid */}
                            <div className="grid grid-cols-3 gap-x-6 gap-y-4">
                                <div className="flex flex-col">
                                    <label className="text-xs font-medium text-slate-600 mb-1">Rego</label>
                                    <input type="text" className="border border-teal-600 bg-white rounded-sm px-3 py-1.5 text-sm outline-none w-full shadow-sm" />
                                </div>
                                <div className="flex flex-col">
                                    <label className="text-xs font-medium text-slate-600 mb-1">State</label>
                                    <select className="border-none bg-[#f5f5f5] rounded-sm px-2 py-1.5 text-sm outline-none w-full shadow-sm text-slate-500">
                                        <option></option>
                                    </select>
                                </div>
                                <div className="flex flex-col">
                                    <label className="text-xs font-medium text-slate-600 mb-1">VIN</label>
                                    <input type="text" className="border-none bg-[#f5f5f5] rounded-sm px-3 py-1.5 text-sm outline-none w-full shadow-sm" />
                                </div>

                                <div className="flex flex-col">
                                    <label className="text-xs font-medium text-slate-600 mb-1">Make</label>
                                    <input type="text" className="border-none bg-[#f5f5f5] rounded-sm px-3 py-1.5 text-sm outline-none w-full shadow-sm" />
                                </div>
                                <div className="flex flex-col">
                                    <label className="text-xs font-medium text-slate-600 mb-1">Model</label>
                                    <input type="text" className="border-none bg-[#f5f5f5] rounded-sm px-3 py-1.5 text-sm outline-none w-full shadow-sm" />
                                </div>
                                <div className="flex flex-col">
                                    <div className="flex justify-between">
                                        <label className="text-xs font-medium text-slate-600 mb-1">Body Type</label>
                                        <span className="text-[10px] text-slate-400 opacity-70">required</span>
                                    </div>
                                    <select className="border-none bg-[#f5f5f5] rounded-sm px-2 py-1.5 text-sm outline-none w-full shadow-sm">
                                        <option>Sedan</option>
                                    </select>
                                </div>

                                <div className="flex flex-col">
                                    <label className="text-xs font-medium text-slate-600 mb-1">Colour</label>
                                    <input type="text" className="border-none bg-[#f5f5f5] rounded-sm px-3 py-1.5 text-sm outline-none w-full shadow-sm" />
                                </div>
                                <div className="flex flex-col">
                                    <label className="text-xs font-medium text-slate-600 mb-1">Odometer</label>
                                    <input type="text" className="border-none bg-[#f5f5f5] rounded-sm px-3 py-1.5 text-sm outline-none w-full shadow-sm" />
                                </div>
                                <div className="flex flex-col">
                                    <label className="text-xs font-medium text-slate-600 mb-1">Build Date</label>
                                    <div className="relative">
                                        <Calendar className="h-4 w-4 absolute left-2 top-2 text-slate-600" />
                                        <input type="text" className="w-full border-none bg-[#f5f5f5] rounded-sm pl-8 pr-3 py-1.5 text-sm outline-none shadow-sm" />
                                    </div>
                                </div>

                                <div className="flex flex-col col-span-3">
                                    <label className="text-xs font-medium text-slate-600 mb-1">Fleet Code</label>
                                    <input type="text" className="border-none bg-[#f5f5f5] rounded-sm px-3 py-1.5 text-sm outline-none w-1/3 shadow-sm" />
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex justify-between items-center mt-auto pt-4">
                                <button
                                    onClick={() => setIsCreatingVehicle(false)}
                                    className="px-4 py-1.5 bg-white border border-slate-300 text-slate-600 font-medium rounded-sm text-sm hover:bg-slate-50 transition-colors shadow-sm">
                                    Cancel
                                </button>
                                <button className="px-6 py-1.5 bg-[#00897b] text-white font-medium rounded-sm text-sm hover:bg-[#00796b] transition-colors shadow-sm">
                                    Save
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 bg-[#fcfcfc] border border-slate-200 m-4 rounded-sm flex items-center justify-center text-slate-400 text-sm">
                            No Vehicles Found
                        </div>
                    )}
                </div>

            </div>

            {/* Booking Details Section */}
            <div className="bg-white rounded-sm border border-slate-300 shadow-sm flex flex-col pb-8">

                {/* Header */}
                <div className="bg-[#f5f5f5] px-4 py-3 border-b border-slate-300 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-slate-800 font-bold text-lg">
                        <Calendar className="h-5 w-5 text-slate-500" />
                        Booking
                    </div>
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                        <div className="h-2 w-2 rounded-full bg-green-500"></div>
                        Open
                    </div>
                </div>

                <div className="p-6 flex flex-col gap-6">
                    {/* Top Row Inputs */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-slate-600">Reference</label>
                            <input type="text" className="border-none bg-slate-100 rounded-sm px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-slate-300" />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-slate-600">CustomerOrder Number</label>
                            <input type="text" className="border-none bg-slate-100 rounded-sm px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-slate-300" />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-slate-600">Booking Date</label>
                            <div className="relative">
                                <Calendar className="h-4 w-4 absolute left-3 top-2.5 text-slate-600" />
                                <input type="text" defaultValue="01/02/2026" className="w-full border-none bg-slate-100 rounded-sm pl-9 pr-3 py-2 text-sm outline-none focus:ring-1 focus:ring-slate-300" />
                            </div>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-slate-600">Due By</label>
                            <div className="relative">
                                <Calendar className="h-4 w-4 absolute left-3 top-2.5 text-slate-600" />
                                <input type="text" className="w-full border-none bg-slate-100 rounded-sm pl-9 pr-3 py-2 text-sm outline-none focus:ring-1 focus:ring-slate-300" />
                            </div>
                        </div>
                    </div>

                    {/* Description */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-slate-600">Description</label>
                        <input type="text" className="border-none bg-slate-100 rounded-sm px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-slate-300 w-full" />
                    </div>

                    {/* Products Table */}
                    <div className="mt-4">
                        <table className="w-full text-sm text-left">
                            <thead className="border-b-2 border-slate-200">
                                <tr>
                                    <th className="px-3 py-3 font-bold text-slate-800 w-1/4">Product</th>
                                    <th className="px-3 py-3 font-bold text-slate-800 w-1/3">Description</th>
                                    <th className="px-3 py-3 font-bold text-slate-800 text-right w-32">Unit Price</th>
                                    <th className="px-3 py-3 font-bold text-slate-800 text-right w-20">Qty</th>
                                    <th className="px-3 py-3 font-bold text-slate-800 text-right w-32">Sales Tax</th>
                                    <th className="px-3 py-3 font-bold text-slate-800 text-right w-32">Line Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr className="bg-[#e8f5e9] border-b border-white hover:bg-[#c8e6c9] transition-colors">
                                    <td className="px-3 py-2">
                                        <div className="flex items-center gap-3">
                                            <button className="text-slate-600 hover:text-red-600 transition-colors">
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                            <span className="font-medium text-slate-800">LAB</span>
                                        </div>
                                    </td>
                                    <td className="px-3 py-2">
                                        <div className="flex items-center gap-2">
                                            <button className="bg-[#81c784] text-white p-1 rounded-sm hover:bg-[#66bb6a] transition-colors">
                                                <Settings className="h-3 w-3" />
                                            </button>
                                            <span className="text-slate-700">Labour</span>
                                        </div>
                                    </td>
                                    <td className="px-3 py-2 text-right text-slate-600">$0.00</td>
                                    <td className="px-3 py-2 text-right text-slate-800">1</td>
                                    <td className="px-3 py-2 text-right text-slate-400">$0.00</td>
                                    <td className="px-3 py-2 text-right text-slate-600">$0.00</td>
                                </tr>
                            </tbody>
                        </table>

                        <div className="mt-2 flex justify-between items-start">
                            <button className="flex items-center bg-[#00897b] hover:bg-[#00796b] text-white rounded-sm text-sm font-medium transition-colors">
                                <div className="px-2 py-1.5 border-r border-[#00695c]">
                                    <Plus className="h-4 w-4" />
                                </div>
                                <div className="px-2 py-1.5">
                                    <ChevronDown className="h-4 w-4" />
                                </div>
                            </button>

                            {/* Totals Box */}
                            <div className="flex flex-col gap-3 w-64 pt-4 border-t border-slate-200">
                                <div className="flex justify-between items-center text-sm font-bold text-slate-700">
                                    <span>Subtotal</span>
                                    <span>$0.00</span>
                                </div>
                                <div className="flex justify-between items-center text-sm font-bold text-slate-700">
                                    <span>Freight</span>
                                    <input
                                        type="text"
                                        className="w-24 text-right border-none bg-slate-100 rounded-sm px-2 py-1 outline-none focus:ring-1 focus:ring-slate-300"
                                        value={freight}
                                        onChange={(e) => setFreight(e.target.value)}
                                    />
                                </div>
                                <div className="flex justify-between items-center text-sm font-bold text-slate-700">
                                    <span>Sales Tax</span>
                                    <span>$0.00</span>
                                </div>
                                <div className="flex justify-between items-center text-lg font-black text-slate-900 mt-2">
                                    <span>Total</span>
                                    <span>$0.00</span>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>

            </div>
        </div>
    );
}
