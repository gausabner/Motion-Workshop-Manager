"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { forTenant } from "@/lib/tenant-db";
import { str, type ActionState } from "@/lib/forms";
import { bookableDays } from "@/lib/bookings/availability";
import { onlineBookingSettings } from "@/lib/settings/schema";
import { toInternational } from "@/lib/messaging/phone";
import { fromZoned, parseMinute } from "@/lib/diary/time";

/**
 * The one form in the app anyone on the internet can submit. It creates a
 * request, never a booking: a person at the workshop decides.
 */

const PER_HOUR = 5;

async function requesterHash(): Promise<string | null> {
    const h = await headers();
    const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
    if (!ip) return null;
    return createHash("sha256").update(`booking.${ip}.${process.env.SESSION_SECRET ?? ""}`).digest("hex");
}

export async function requestBooking(slug: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
    const tenant = await prisma.tenant.findUnique({ where: { slug } });
    if (!tenant?.isActive || !onlineBookingSettings(tenant.settings).enabled) return { ok: false, message: "Online booking is not open for this workshop." };
    const db = forTenant(tenant.id);

    // A field no person can see. Anything that fills it in is a script — thank it and keep nothing.
    if (str(formData, "website")) redirect(`/${slug}/book/thanks`);

    const ipHash = await requesterHash();
    if (ipHash) {
        const recent = await db.bookingRequest.count({ where: { ipHash, createdAt: { gte: new Date(Date.now() - 3_600_000) } } });
        if (recent >= PER_HOUR) return { ok: false, message: "That is a lot of requests from one place. Please phone the workshop instead." };
    }

    const typeId = str(formData, "type") ?? "";
    const day = str(formData, "day") ?? "";
    const minute = parseMinute(str(formData, "time") ?? "");
    const firstName = str(formData, "firstName")?.slice(0, 60);
    const lastName = str(formData, "lastName")?.slice(0, 60);
    const mobile = toInternational(str(formData, "mobile"), tenant.country);
    const email = str(formData, "email")?.slice(0, 120);
    const plate = str(formData, "plate")?.slice(0, 20);
    const vehicle = str(formData, "vehicle")?.slice(0, 80);
    const notes = str(formData, "notes")?.slice(0, 500);

    const errors: Record<string, string[]> = {};
    if (!firstName) errors.firstName = ["Your first name, please"];
    if (!lastName) errors.lastName = ["Your surname, please"];
    if (!mobile) errors.mobile = ["A mobile number we can reach you on"];
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = ["That email does not look right"];
    if (Object.keys(errors).length) return { ok: false, message: "Please check the highlighted details.", errors };

    const type = await db.appointmentType.findUnique({ where: { id: typeId }, select: { id: true, description: true, estimatedHours: true, active: true } });
    if (!type?.active || !/^\d{4}-\d{2}-\d{2}$/.test(day) || minute === null) return { ok: false, message: "Something about that booking did not come through. Please start again." };
    const minutes = Math.max(15, Math.round(type.estimatedHours.toNumber() * 60));

    // Checked again at the moment of booking: somebody else may have taken the slot while this form was open.
    const offered = (await bookableDays(db, tenant, minutes)).find((d) => d.day === day);
    if (!offered?.slots.includes(minute)) return { ok: false, message: "That time has just been taken. Please go back and choose another." };

    const request = await db.bookingRequest.create({
        data: {
            tenantId: tenant.id,
            requestedAt: fromZoned(day, minute, tenant.timezone),
            minutes,
            appointmentTypeId: type.id,
            service: type.description,
            firstName: firstName!,
            lastName: lastName!,
            mobile: `+${mobile}`,
            email: email ?? null,
            plate: plate ?? null,
            vehicleDescription: vehicle ?? null,
            notes: notes ?? null,
            ipHash,
        },
        select: { id: true },
    });
    redirect(`/${slug}/book/thanks?ref=${request.id.slice(-6).toUpperCase()}`);
}
