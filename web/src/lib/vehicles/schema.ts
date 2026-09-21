import { z } from "zod";
import { optionalDate, optionalInt, optionalNumber } from "@/lib/forms";

export const VEHICLE_GROUPS = ["Passenger", "Light commercial / bakkie", "SUV / 4x4", "Motorcycle", "Trailer / caravan", "Truck", "Machinery / agricultural", "Marine"] as const;
export const TRANSMISSIONS = ["Manual", "Automatic", "CVT", "DSG / dual-clutch"] as const;
export const DRIVE_TYPES = ["Front-wheel drive", "Rear-wheel drive", "All-wheel drive", "4x4 selectable"] as const;
export const FUEL_TYPES = ["Petrol", "Diesel", "Hybrid", "Electric", "LPG"] as const;

const opt = z.string().trim().max(120).optional();

export const vehicleSchema = z.object({
    customerId: opt,
    plate: z.string().trim().min(1, "Required").max(20).transform((s) => s.toUpperCase()),
    vin: z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^[A-HJ-NPR-Z0-9]{17}$/, "A VIN is 17 characters (no I, O or Q)")
        .optional()
        .or(z.literal("").transform(() => undefined)),
    make: z.string().trim().min(1, "Required").max(100),
    model: z.string().trim().min(1, "Required").max(100),
    modelSeries: opt,
    year: optionalInt.refine((y) => y === undefined || (y >= 1950 && y <= new Date().getFullYear() + 1), "Enter a valid year"),
    engineNumber: opt,
    chassisNumber: opt,
    engineCode: opt,
    fleetCode: opt,
    vehicleGroup: opt,
    bodyType: opt,
    transmission: opt,
    driveType: opt,
    fuelType: opt,
    cylinders: optionalInt,
    litres: optionalNumber,
    hasAc: z.boolean().default(false),
    seating: optionalInt,
    colour: opt,
    tyreSize: opt,
    keyCode: opt,
    radioPin: opt,
    odometer: optionalInt,
    engineHours: optionalNumber,
    licenceExpiry: optionalDate,
    roadworthyExpiry: optionalDate,
    lastServiceDate: optionalDate,
    nextServiceDate: optionalDate,
    nextServiceKm: optionalInt,
    serviceIntervalMonths: optionalInt,
    note: z.string().trim().max(4000).optional(),
});

export type VehicleInput = z.infer<typeof vehicleSchema>;
