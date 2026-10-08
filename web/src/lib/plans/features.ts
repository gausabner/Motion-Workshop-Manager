/**
 * What each plan buys, as features the app can check.
 *
 * The pricing page is the contract (`lib/pricing/plans.ts`): this is the same
 * three tiers, said in the terms the code needs. A feature belongs to the
 * cheapest plan that lists it, and every plan above includes everything below.
 * What the pricing page does not put in a higher tier — the diary, job cards,
 * invoices, receipts, sending, customers and vehicles, what customers owe,
 * profit, the mechanic clock, the portal, online booking, importing, and
 * taking every table out as CSV — is not gated at all.
 *
 * Pure, so the rules can be tested, and so the same answer reaches the
 * navigation, the pages, the server actions and the database layer.
 */

export type PlanId = "workshop" | "full" | "council";

export type Feature = "stock" | "purchasing" | "inspections" | "reminders" | "loanCars" | "ownerReports" | "auditPack" | "handoff" | "api";

export const PLAN_NAMES: Record<PlanId, string> = { workshop: "Workshop", full: "Full workshop", council: "Council and multi-site" };

export const FEATURES: Record<Feature, { name: string; plan: PlanId; what: string }> = {
    stock: {
        name: "Parts and stock",
        plan: "full",
        what: "Products and stock on hand, stock takes, bundles, price matrices and serial numbers.",
    },
    purchasing: {
        name: "Purchasing and suppliers",
        plan: "full",
        what: "Suppliers, purchase orders, supplier invoices and what you owe them.",
    },
    inspections: { name: "Inspections", plan: "full", what: "Vehicle inspections the customer approves on their phone." },
    reminders: {
        name: "Reminders and campaigns",
        plan: "full",
        what: "Service and licence reminders, and messages to many customers at once.",
    },
    loanCars: { name: "Courtesy cars", plan: "full", what: "Loan cars booked, handed over and returned against a job." },
    ownerReports: {
        name: "The owner reports",
        plan: "full",
        what: "Profit by job, item sales, work in progress, quote outcomes, stock, creditors and renewals.",
    },
    auditPack: {
        name: "The council audit pack",
        plan: "council",
        what: "The six exports a council audit asks for, including the number-sequence report.",
    },
    handoff: { name: "Accounting hand-off", plan: "council", what: "The nightly journal into your accounting system." },
    api: { name: "The public API", plan: "council", what: "API keys, for connecting other systems to MOTION." },
};

const RANK: Record<PlanId, number> = { workshop: 0, full: 1, council: 2 };

export const ALL_FEATURES = Object.keys(FEATURES) as Feature[];

/** A subscription's plan id, as a plan. Anything unrecognised is treated as no plan rather than guessed at. */
export function asPlanId(planId: string | null | undefined): PlanId | null {
    return planId === "workshop" || planId === "full" || planId === "council" ? planId : null;
}

/**
 * Whether a plan includes a feature.
 *
 * `null` is a workshop with no plan: one switched on before plans existed,
 * whose billing staff have not set up yet. It keeps everything it had until
 * they do — taking features away from a paying customer is a conversation, not
 * a migration.
 */
export function includes(plan: PlanId | null, feature: Feature): boolean {
    return plan === null || RANK[plan] >= RANK[FEATURES[feature].plan];
}

export function featuresOf(plan: PlanId | null): Feature[] {
    return ALL_FEATURES.filter((f) => includes(plan, f));
}

/**
 * Tables that only a feature's own screens write. When the plan lacks the
 * feature, the database layer refuses writes to them — a backstop under the
 * pages and actions, for a path somebody adds later and forgets to gate.
 *
 * Deliberately short. A table also written as a side effect of everyday work
 * is not here: stock movements and serial numbers are posted when an invoice
 * is processed, and reminders are unlinked when a document is deleted, so
 * refusing those would break the base product for a workshop that once had a
 * higher plan.
 */
export const FEATURE_MODELS: Partial<Record<Feature, string[]>> = {
    stock: ["StockTake", "StockTakeLine", "PriceMatrix", "PriceMatrixBand", "BundleItem"],
    purchasing: ["Supplier", "PurchaseOrder", "PurchaseOrderLine", "SupplierInvoice", "SupplierInvoiceLine", "SupplierPayment", "SupplierPaymentAllocation"],
    inspections: ["InspectionTemplate", "InspectionTemplateItem", "Inspection", "InspectionItem"],
    reminders: ["Campaign", "CampaignRecipient"],
    loanCars: ["LoanVehicle", "Loan"],
    api: ["ApiKey"],
};

/** The tables refused to a plan, each with the feature it belongs to. */
export function blockedModels(plan: PlanId | null): Map<string, Feature> {
    const blocked = new Map<string, Feature>();
    for (const [feature, models] of Object.entries(FEATURE_MODELS) as [Feature, string[]][]) {
        if (!includes(plan, feature)) for (const m of models) blocked.set(m, feature);
    }
    return blocked;
}

export function isFeature(value: string | null | undefined): value is Feature {
    return !!value && value in FEATURES;
}
