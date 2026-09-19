import { z } from "zod";

const money = z.coerce.number().min(0, "Cannot be negative").max(99_999_999);
const optionalId = z.union([z.literal(""), z.string().max(40)]).optional().transform((v) => (v ? v : null));

/** A product as the form sends it. Prices are kept apart from stock: one is a decision, the other a fact. */
export const productSchema = z.object({
    itemCode: z.string().trim().min(1, "Every product needs a code").max(40),
    description: z.string().trim().min(1, "Give it a description").max(200),
    description2: z.string().trim().max(200).optional(),
    type: z.enum(["STOCK", "LABOUR", "SUBLET", "CONSUMABLE", "ACCESSORY", "TYRE"]),
    isService: z.coerce.boolean(),
    vatExempt: z.coerce.boolean(),
    dontUpdateQty: z.coerce.boolean(),
    brand: z.string().trim().max(80).optional(),
    location: z.string().trim().max(40).optional(),
    comment: z.string().trim().max(500).optional(),
    jobCardComment: z.string().trim().max(500).optional(),
    groupId: optionalId,
    categoryId: optionalId,
    supplierId: optionalId,
    costExTax: money,
    retailPrice: money,
    price2: money,
    price3: money,
    price4: money,
    minQty: z.coerce.number().min(0).max(999_999),
    maxQty: z.coerce.number().min(0).max(999_999),
    defaultLabourQty: z.union([z.literal(""), z.coerce.number().min(0).max(999)]).optional().transform((v) => (v === "" || v === undefined ? null : Number(v))),
});

export type ProductInput = z.infer<typeof productSchema>;

export const adjustSchema = z.object({
    quantity: z.coerce.number().refine((n) => n !== 0, "Give a quantity to add or take away").refine(Number.isFinite, "Not a number"),
    kind: z.enum(["ADJUSTMENT", "STOCKTAKE", "OPENING"]),
    note: z.string().trim().min(3, "Say why, so the movement explains itself later").max(200),
});
