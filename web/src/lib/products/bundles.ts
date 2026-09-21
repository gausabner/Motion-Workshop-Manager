import type { BundlePricing, LineType } from "@prisma/client";
import { round2 } from "@/lib/documents/totals";

/**
 * Bundles — "minor service" as one line that is really oil, a filter and an
 * hour of labour.
 *
 * The rule that makes everything else work: the components are always real
 * lines, so stock moves and the job costs what it cost. Only the money moves
 * around. On a fixed-price bundle the parent carries the price and the
 * components carry the cost; on a summed bundle each component carries both
 * and the parent is only a heading. Either way, nothing is counted twice.
 */

export type BundleComponent = {
    productId: string;
    description: string;
    lineType: LineType;
    /** How many per bundle. */
    quantity: number;
    unitPrice: number;
    unitCost: number;
    vatRate: number;
};

export type BundleSpec = {
    productId: string;
    description: string;
    lineType: LineType;
    pricing: BundlePricing;
    /** Used when pricing is FIXED. */
    price: number;
    vatRate: number;
    components: BundleComponent[];
};

export type ExpandedLine = {
    bundleGroup: string;
    bundleRole: "PARENT" | "COMPONENT";
    productId: string;
    lineType: LineType;
    description: string;
    quantity: number;
    unitPrice: number;
    unitCost: number;
    vatRate: number;
};

/** What a summed bundle comes to, before any discount. */
export function bundlePrice(bundle: BundleSpec): number {
    if (bundle.pricing === "FIXED") return round2(bundle.price);
    return round2(bundle.components.reduce((total, c) => total + c.quantity * c.unitPrice, 0));
}

/** What it costs the workshop, whichever way it is priced. */
export function bundleCost(bundle: BundleSpec): number {
    return round2(bundle.components.reduce((total, c) => total + c.quantity * c.unitCost, 0));
}

/**
 * One bundle, as the lines that go on the document.
 *
 * `quantity` is how many bundles: two minor services means twice each
 * component. The group key ties them together so they can be moved, removed
 * and printed as one thing.
 */
export function expandBundle(bundle: BundleSpec, quantity: number, group: string): ExpandedLine[] {
    const many = round2(quantity);
    const fixed = bundle.pricing === "FIXED";
    const parent: ExpandedLine = {
        bundleGroup: group,
        bundleRole: "PARENT",
        productId: bundle.productId,
        lineType: bundle.lineType,
        description: bundle.description,
        quantity: many,
        // A summed bundle's parent is a heading; its money sits on the components.
        unitPrice: fixed ? round2(bundle.price) : 0,
        unitCost: 0,
        vatRate: bundle.vatRate,
    };
    const components = bundle.components.map<ExpandedLine>((c) => ({
        bundleGroup: group,
        bundleRole: "COMPONENT",
        productId: c.productId,
        lineType: c.lineType,
        description: c.description,
        quantity: round2(c.quantity * many),
        // On a fixed-price bundle the price is on the parent, so the component must not charge again.
        unitPrice: fixed ? 0 : round2(c.unitPrice),
        unitCost: round2(c.unitCost),
        vatRate: c.vatRate,
    }));
    return [parent, ...components];
}

/** A bundle that would charge nothing, or cost nothing, is worth saying out loud before it is sold. */
export function bundleWarnings(bundle: BundleSpec): string[] {
    const warnings: string[] = [];
    if (bundle.components.length === 0) warnings.push("This bundle has nothing in it.");
    if (bundle.pricing === "FIXED" && round2(bundle.price) === 0) warnings.push("This bundle has no price on it, so it would be sold for nothing.");
    if (bundle.components.some((c) => c.quantity <= 0)) warnings.push("A component with no quantity will not be charged or taken off the shelf.");
    const cost = bundleCost(bundle);
    const price = bundlePrice(bundle);
    if (price > 0 && cost > price) warnings.push(`The parts and labour in it cost ${cost.toFixed(2)}, which is more than the ${price.toFixed(2)} it sells for.`);
    return warnings;
}

/** Group expanded lines back into bundles, for printing and for the editor. */
export function groupBundles<T extends { bundleGroup?: string | null; bundleRole?: string | null }>(lines: T[]): Map<string, { parent: T | null; components: T[] }> {
    const groups = new Map<string, { parent: T | null; components: T[] }>();
    for (const line of lines) {
        if (!line.bundleGroup) continue;
        const group = groups.get(line.bundleGroup) ?? { parent: null, components: [] };
        if (line.bundleRole === "PARENT") group.parent = line;
        else group.components.push(line);
        groups.set(line.bundleGroup, group);
    }
    return groups;
}
