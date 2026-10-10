import { z } from "zod";

const money = z.coerce.number().min(0, "This cannot be negative.").max(99_999_999);
const optionalId = z.union([z.literal(""), z.string().max(40)]).optional().transform((v) => (v ? v : null));

/** A product as the form sends it. Prices are kept apart from stock: one is a decision, the other a fact. */
export const productSchema = z.object({
    itemCode: z.string({ error: "Enter a product code." }).trim().min(1, "Enter a product code.").max(40),
    description: z.string({ error: "Enter a description." }).trim().min(1, "Enter a description.").max(200),
    description2: z.string().trim().max(200).optional(),
    type: z.enum(["STOCK", "LABOUR", "SUBLET", "CONSUMABLE", "ACCESSORY", "TYRE"]),
    isService: z.coerce.boolean(),
    vatExempt: z.coerce.boolean(),
    dontUpdateQty: z.coerce.boolean(),
    requiresSerial: z.coerce.boolean(),
    warrantyMonths: z.union([z.literal(""), z.coerce.number().int().min(0).max(600)]).optional().transform((v) => (v === "" || v === undefined ? null : Number(v))),
    brand: z.string().trim().max(80).optional(),
    location: z.string().trim().max(40).optional(),
    comment: z.string().trim().max(500).optional(),
    jobCardComment: z.string().trim().max(500).optional(),
    groupId: optionalId,
    categoryId: optionalId,
    supplierId: optionalId,
    priceMatrixId: optionalId,
    costExTax: money,
    retailPrice: money,
    price2: money,
    price3: money,
    price4: money,
    minQty: z.coerce.number().min(0).max(999_999),
    maxQty: z.coerce.number().min(0).max(999_999),
    isBundle: z.coerce.boolean(),
    bundlePricing: z.enum(["FIXED", "SUM"]),
    bundlePrinting: z.enum(["COMPONENTS", "BUNDLE_ONLY"]),
    defaultLabourQty: z.union([z.literal(""), z.coerce.number().min(0).max(999)]).optional().transform((v) => (v === "" || v === undefined ? null : Number(v))),
});

export type ProductInput = z.infer<typeof productSchema>;

export const adjustSchema = z.object({
    quantity: z.coerce.number().refine((n) => n !== 0, "Enter a quantity to add or remove.").refine(Number.isFinite, "Enter a number."),
    kind: z.enum(["ADJUSTMENT", "STOCKTAKE", "OPENING"]),
    note: z.string().trim().min(3, "Enter a reason, so the movement can be understood later.").max(200),
});

export const bundleItemsSchema = z.array(z.object({
    componentId: z.string().min(1).max(40),
    quantity: z.coerce.number().min(0.01, "Enter a quantity for each component.").max(9_999),
})).max(50, "A bundle can have at most 50 components.");
