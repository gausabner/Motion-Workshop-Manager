import { z } from "zod";
import { optionalDate, optionalInt, optionalNumber } from "@/lib/forms";

export const DOCUMENT_TYPES = ["QUOTE", "BOOKING", "JOB_CARD", "INVOICE", "CASH_SALE", "CREDIT"] as const;
export const JOB_STATUSES = [
    "BOOKED_IN", "WORK_IN_PROGRESS", "WAITING_FOR_PARTS", "INSPECTION_IN_PROGRESS",
    "WAITING_FOR_CUSTOMER_APPROVAL", "JOB_COMPLETE", "CUSTOMER_NOTIFIED", "AWAITING_FINALISE", "FINALISED",
] as const;
export const LINE_TYPES = ["STOCK", "LABOUR", "SUBLET", "CONSUMABLE", "ACCESSORY", "TYRE", "FREIGHT"] as const;

const opt = z.string().trim().max(255).optional();

export const documentLineSchema = z.object({
    /** Existing line id, or absent for a new row. */
    id: z.string().optional(),
    productId: z.string().optional().nullable(),
    lineType: z.enum(LINE_TYPES).default("STOCK"),
    description: z.string().trim().min(1, "Description is required").max(255),
    // Negative quantities are how a credit note returns goods, so no lower bound here.
    quantity: z.coerce.number().finite(),
    hours: z.preprocess((v) => (v === "" || v === undefined || v === null ? null : Number(v)), z.number().finite().min(0, "Cannot be negative").nullable()),
    unitPrice: z.coerce.number().finite().min(0, "Cannot be negative"),
    unitCost: z.coerce.number().finite().min(0).default(0),
    vatRate: z.coerce.number().finite().min(0).max(100).default(15),
    discountPercent: z.coerce.number().finite().min(0).max(100).default(0),
    serialNumbers: opt.nullable(),
    isCustomerSupplied: z.coerce.boolean().default(false),
});

export const documentHeaderSchema = z.object({
    customerId: opt.nullable(),
    isCashSale: z.coerce.boolean().default(false),
    vehicleId: opt.nullable(),
    serviceAdvisorId: opt.nullable(),
    mechanicId: opt.nullable(),
    reference: opt,
    customerOrderNumber: opt,
    postDate: optionalDate,
    dueDate: optionalDate,
    followUpDate: optionalDate,
    // Kept as the wall-clock text the form sent: only the action knows the
    // workshop's timezone, and `new Date()` here would read it in the server's.
    scheduledAt: z.preprocess(
        (v) => (v === "" || v == null ? undefined : v),
        z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/, "Use a date and time").optional(),
    ),
    estimatedHours: optionalNumber,
    odometer: optionalInt,
    nextServiceKm: optionalInt,
    nextServiceDate: optionalDate,
    jobStatus: z.enum(JOB_STATUSES).optional(),
    statusComment: opt,
    isInternal: z.coerce.boolean().default(false),
    paymentTermsDays: optionalInt,
    discountPercent: optionalNumber,
    discountAmount: optionalNumber,
    freight: optionalNumber,
    eventNotes: z.string().trim().max(8000).optional(),
    jobCardNotes: z.string().trim().max(8000).optional(),
    invoiceNotes: z.string().trim().max(8000).optional(),
});

export const saveDocumentSchema = documentHeaderSchema.extend({
    lines: z.array(documentLineSchema).max(200, "A document can hold at most 200 lines"),
});

export type DocumentLineInput = z.infer<typeof documentLineSchema>;
export type SaveDocumentInput = z.infer<typeof saveDocumentSchema>;

/** A customer is required on everything except a cash sale (PRD DOC-01). */
export function requiresCustomer(type: string, isCashSale: boolean): boolean {
    return !isCashSale && type !== "CASH_SALE";
}
