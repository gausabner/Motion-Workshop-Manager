import { z } from "zod";
import { optionalDate } from "@/lib/forms";

/** One way the money arrived: cash, a card slip, an EFT with its reference. */
export const tenderSchema = z.object({
    id: z.string().optional(),
    methodId: z.string().min(1, "Choose how the money was paid"),
    amount: z.coerce.number().finite(),
    /** What was physically handed over, when more than was kept. The difference is change. */
    tendered: z.coerce.number().finite().optional().nullable(),
    reference: z.string().trim().max(120).optional().nullable(),
});

/**
 * An allocation is signed the way the document's outstanding is signed, so no
 * lower bound here — a credit note takes a negative amount.
 */
export const allocationSchema = z.object({
    documentId: z.string().min(1),
    amount: z.coerce.number().finite(),
});

export const savePaymentSchema = z.object({
    customerId: z.string().min(1, "Choose a customer"),
    postDate: optionalDate,
    note: z.string().trim().max(500).optional(),
    tenders: z.array(tenderSchema).max(10, "That is more tenders than one receipt needs"),
    allocations: z.array(allocationSchema).max(200),
});

export type SavePaymentInput = z.infer<typeof savePaymentSchema>;
