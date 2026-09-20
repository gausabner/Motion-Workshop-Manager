import { z } from "zod";
import { withKey } from "@/lib/api/auth";
import { fail, json, moment, paging, cursorArgs, page } from "@/lib/api/http";
import { createLinked, lookupByExternalId } from "@/lib/api/external";
import { bookableDays } from "@/lib/bookings/availability";
import { fromZoned, parseMinute, toZoned } from "@/lib/diary/time";
import { toInternational } from "@/lib/messaging/phone";

/**
 * What a workshop's own website posts to.
 *
 * It creates a *request*, never a booking — the same queue the public booking
 * form feeds, decided by a person at the workshop. A key that could write
 * straight into the diary would let a website fill a bay with nobody having
 * agreed to it.
 *
 * GET lists the open slots, so the website can draw a picker without
 * reimplementing capacity, working hours or time off.
 */

const SHAPE = (r: {
    id: string; status: string; requestedAt: Date; minutes: number; service: string;
    firstName: string; lastName: string; mobile: string; email: string | null; plate: string | null;
    vehicleDescription: string | null; notes: string | null; documentId: string | null; createdAt: Date;
}) => ({
    id: r.id,
    status: r.status,
    requestedAt: moment(r.requestedAt),
    minutes: r.minutes,
    service: r.service,
    customer: { firstName: r.firstName, lastName: r.lastName, mobile: r.mobile, email: r.email },
    vehicle: { plate: r.plate, description: r.vehicleDescription },
    notes: r.notes,
    /** Set once somebody at the workshop approves it and the booking exists. */
    documentId: r.documentId,
    createdAt: moment(r.createdAt),
});

const SELECT = {
    id: true, status: true, requestedAt: true, minutes: true, service: true, firstName: true, lastName: true,
    mobile: true, email: true, plate: true, vehicleDescription: true, notes: true, documentId: true, createdAt: true,
} as const;

export const GET = withKey("READ", async (caller, req) => {
    const url = new URL(req.url);

    // ?slots=<appointmentTypeId> answers "when could somebody come in", not "what has been asked for".
    const typeId = url.searchParams.get("slots");
    if (typeId) {
        const type = await caller.db.appointmentType.findUnique({ where: { id: typeId }, select: { id: true, description: true, estimatedHours: true, active: true } });
        if (!type?.active) return fail("not_found", "No bookable appointment type with that id.");
        const minutes = Math.max(15, Math.round(type.estimatedHours.toNumber() * 60));
        const days = await bookableDays(caller.db, caller.tenant, minutes);
        return json({
            data: {
                appointmentType: { id: type.id, description: type.description, minutes },
                days: days.map((d) => ({ day: d.day, slots: d.slots.map(clockFace) })),
            },
        });
    }

    const { limit, cursor } = paging(url);
    const status = url.searchParams.get("status")?.toUpperCase();
    const rows = await caller.db.bookingRequest.findMany({
        where: status === "PENDING" || status === "APPROVED" || status === "DECLINED" ? { status } : {},
        orderBy: { id: "asc" },
        select: SELECT,
        ...cursorArgs(cursor, limit),
    });
    const paged = page(rows, limit);
    return json({ data: paged.data.map(SHAPE), nextCursor: paged.nextCursor });
});

/** Minutes past midnight are how the diary stores a time; a website wants "08:30". */
const clockFace = (minute: number) => `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;

const createSchema = z.object({
    appointmentTypeId: z.string({ error: "Which service is it for?" }).trim().min(1, "Which service is it for?"),
    day: z.string({ error: "`day` must look like 2026-09-21." }).regex(/^\d{4}-\d{2}-\d{2}$/, "`day` must look like 2026-09-21."),
    time: z.string({ error: "`time` must look like 08:30." }).regex(/^\d{1,2}:\d{2}$/, "`time` must look like 08:30."),
    firstName: z.string({ error: "A first name is needed." }).trim().min(1, "A first name is needed.").max(60),
    lastName: z.string({ error: "A surname is needed." }).trim().min(1, "A surname is needed.").max(60),
    mobile: z.string({ error: "A mobile number is needed." }).trim().min(1, "A mobile number is needed."),
    email: z.string().trim().email("That email does not look right.").max(120).optional().or(z.literal("")),
    plate: z.string().trim().max(20).optional(),
    vehicle: z.string().trim().max(80).optional(),
    notes: z.string().trim().max(500).optional(),
    externalId: z.string().trim().min(1).max(200).optional(),
});

export const POST = withKey("WRITE", async (caller, req) => {
    const body = await req.json().catch(() => null);
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
        const issue = parsed.error.issues[0];
        return fail("invalid_request", issue?.message ?? "That request could not be read.", { field: issue?.path.join(".") });
    }
    const input = parsed.data;

    // A website that times out and retries must not book the same person in twice.
    if (input.externalId) {
        const existing = await lookupByExternalId(caller, "booking", input.externalId);
        if (existing) {
            const row = await caller.db.bookingRequest.findUnique({ where: { id: existing }, select: SELECT });
            if (row) return json({ data: SHAPE(row), created: false });
        }
    }

    const mobile = toInternational(input.mobile, caller.tenant.country);
    if (!mobile) return fail("invalid_request", "That mobile number could not be read.", { field: "mobile" });

    const type = await caller.db.appointmentType.findUnique({
        where: { id: input.appointmentTypeId },
        select: { id: true, description: true, estimatedHours: true, active: true },
    });
    if (!type?.active) return fail("invalid_request", "No bookable appointment type with that id.", { field: "appointmentTypeId" });

    const minute = parseMinute(input.time);
    if (minute === null) return fail("invalid_request", "`time` must look like 08:30.", { field: "time" });
    const minutes = Math.max(15, Math.round(type.estimatedHours.toNumber() * 60));

    // Capacity is checked here, not on the website: the diary is the only thing that knows.
    const offered = (await bookableDays(caller.db, caller.tenant, minutes)).find((d) => d.day === input.day);
    if (!offered?.slots.includes(minute)) return fail("conflict", "That time is not open. Ask for the slots again and choose another.");

    const created = await createLinked(caller, "booking", input.externalId, (tx) =>
        tx.bookingRequest.create({
            data: {
                tenantId: caller.tenant.id,
                requestedAt: fromZoned(input.day, minute, caller.tenant.timezone),
                minutes,
                appointmentTypeId: type.id,
                service: type.description,
                firstName: input.firstName,
                lastName: input.lastName,
                mobile: `+${mobile}`,
                email: input.email || null,
                plate: input.plate || null,
                vehicleDescription: input.vehicle || null,
                notes: input.notes || null,
            },
            select: SELECT,
        }),
    );

    return json(
        {
            data: SHAPE(created),
            created: true,
            // Said plainly, because an integrator reading this once should not have to guess.
            note: `Waiting for the workshop to confirm. Requested for ${toZoned(created.requestedAt, caller.tenant.timezone).day}.`,
        },
        { status: 201 },
    );
});
