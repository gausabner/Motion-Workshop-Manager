import "server-only";
import type { Prisma } from "@prisma/client";
import { amount, day, moment, quantity } from "./http";

/**
 * What each record looks like on the wire.
 *
 * Deliberately narrower than the tables behind them. Their vehicle record
 * carries 151 columns — marine, trailer and instrument fields on every car —
 * and their invoice carries ~40 accounting-sync columns, so an integrator has
 * to work out which handful matter. We publish the handful. Anything a caller
 * genuinely needs can be added later; a field published once cannot be taken
 * back without breaking somebody.
 *
 * Money is a string (see `amount`). Balances are computed, never read from a
 * column, because we do not store them.
 */

export const CUSTOMER_SELECT = {
    id: true, firstName: true, lastName: true, isBusiness: true, email: true, phone: true, mobile: true,
    vatNumber: true, preferredContact: true, streetAddress1: true, streetCity: true, streetRegion: true,
    creditLimit: true, paymentTermsDays: true, archivedAt: true, createdAt: true, updatedAt: true,
} satisfies Prisma.CustomerSelect;

export function customerShape(c: Prisma.CustomerGetPayload<{ select: typeof CUSTOMER_SELECT }>) {
    return {
        id: c.id,
        name: `${c.firstName} ${c.lastName}`.trim(),
        firstName: c.firstName,
        lastName: c.lastName,
        isBusiness: c.isBusiness,
        email: c.email,
        phone: c.phone,
        mobile: c.mobile,
        vatNumber: c.vatNumber,
        preferredContact: c.preferredContact,
        address: { line1: c.streetAddress1, city: c.streetCity, region: c.streetRegion },
        creditLimit: amount(c.creditLimit),
        paymentTermsDays: c.paymentTermsDays,
        archived: c.archivedAt !== null,
        createdAt: moment(c.createdAt),
        updatedAt: moment(c.updatedAt),
    };
}

export const VEHICLE_SELECT = {
    id: true, customerId: true, plate: true, vin: true, make: true, model: true, year: true, colour: true,
    fuelType: true, transmission: true, odometer: true, licenceExpiry: true, roadworthyExpiry: true,
    lastServiceDate: true, nextServiceDate: true, nextServiceKm: true, vehicleGroup: true,
    archivedAt: true, createdAt: true, updatedAt: true,
} satisfies Prisma.VehicleSelect;

export function vehicleShape(v: Prisma.VehicleGetPayload<{ select: typeof VEHICLE_SELECT }>) {
    return {
        id: v.id,
        customerId: v.customerId,
        plate: v.plate,
        vin: v.vin,
        make: v.make,
        model: v.model,
        year: v.year,
        colour: v.colour,
        fuelType: v.fuelType,
        transmission: v.transmission,
        odometer: v.odometer,
        group: v.vehicleGroup,
        // Localised compliance: a licence disc and a roadworthy, not a WOF or a rego.
        licenceExpiry: day(v.licenceExpiry),
        roadworthyExpiry: day(v.roadworthyExpiry),
        lastServiceDate: day(v.lastServiceDate),
        nextServiceDate: day(v.nextServiceDate),
        nextServiceKm: v.nextServiceKm,
        archived: v.archivedAt !== null,
        createdAt: moment(v.createdAt),
        updatedAt: moment(v.updatedAt),
    };
}

export const PRODUCT_SELECT = {
    id: true, itemCode: true, description: true, type: true, isService: true, brand: true, location: true,
    qtyOnHand: true, minQty: true, retailPrice: true, vatExempt: true, requiresSerial: true,
    archivedAt: true, createdAt: true, updatedAt: true,
} satisfies Prisma.ProductSelect;

/** Cost is not published: a key that can read prices should not hand out margins. */
export function productShape(p: Prisma.ProductGetPayload<{ select: typeof PRODUCT_SELECT }>) {
    return {
        id: p.id,
        itemCode: p.itemCode,
        description: p.description,
        type: p.type,
        isService: p.isService,
        brand: p.brand,
        location: p.location,
        qtyOnHand: quantity(p.qtyOnHand),
        minQty: quantity(p.minQty),
        retailPrice: amount(p.retailPrice),
        vatExempt: p.vatExempt,
        requiresSerial: p.requiresSerial,
        archived: p.archivedAt !== null,
        createdAt: moment(p.createdAt),
        updatedAt: moment(p.updatedAt),
    };
}

export const DOCUMENT_SELECT = {
    id: true, type: true, state: true, jobStatus: true, number: true, jobNumber: true, customerId: true,
    vehicleId: true, reference: true, description: true, postDate: true, dueDate: true, scheduledAt: true,
    scheduledEnd: true, odometer: true, isInternal: true, isCashSale: true, taxName: true, taxRate: true,
    pricesIncludeTax: true, subtotal: true, vatTotal: true, total: true, createdAt: true, updatedAt: true,
} satisfies Prisma.DocumentSelect;

export const LINE_SELECT = {
    id: true, sortOrder: true, productId: true, lineType: true, description: true, quantity: true,
    hours: true, unitPrice: true, vatRate: true, discountPercent: true, lineSubtotal: true,
    vatAmount: true, lineTotal: true, serialNumbers: true,
} satisfies Prisma.DocumentLineSelect;

type DocumentRow = Prisma.DocumentGetPayload<{ select: typeof DOCUMENT_SELECT }>;
type LineRow = Prisma.DocumentLineGetPayload<{ select: typeof LINE_SELECT }>;

/**
 * `paid` and `due` are passed in because they come from allocations, not from
 * the document — the one rule this codebase will not bend. A credit note's
 * totals stay negative, as they are stored: the sale run backwards.
 */
export function documentShape(d: DocumentRow, extra?: { paid?: Prisma.Decimal | number; due?: Prisma.Decimal | number; lines?: LineRow[] }) {
    return {
        id: d.id,
        type: d.type,
        state: d.state,
        jobStatus: d.jobStatus,
        number: d.number,
        jobNumber: d.jobNumber,
        customerId: d.customerId,
        vehicleId: d.vehicleId,
        reference: d.reference,
        description: d.description,
        postDate: day(d.postDate),
        dueDate: day(d.dueDate),
        scheduledAt: moment(d.scheduledAt),
        scheduledEnd: moment(d.scheduledEnd),
        odometer: d.odometer,
        isInternal: d.isInternal,
        isCashSale: d.isCashSale,
        tax: { name: d.taxName, rate: amount(d.taxRate), pricesInclude: d.pricesIncludeTax },
        subtotal: amount(d.subtotal),
        taxTotal: amount(d.vatTotal),
        total: amount(d.total),
        ...(extra?.paid !== undefined ? { paid: amount(extra.paid) } : {}),
        ...(extra?.due !== undefined ? { due: amount(extra.due) } : {}),
        ...(extra?.lines ? { lines: extra.lines.map(lineShape) } : {}),
        createdAt: moment(d.createdAt),
        updatedAt: moment(d.updatedAt),
    };
}

export function lineShape(l: LineRow) {
    return {
        id: l.id,
        sortOrder: l.sortOrder,
        productId: l.productId,
        lineType: l.lineType,
        description: l.description,
        quantity: quantity(l.quantity),
        hours: quantity(l.hours),
        unitPrice: amount(l.unitPrice),
        taxRate: amount(l.vatRate),
        discountPercent: amount(l.discountPercent),
        subtotal: amount(l.lineSubtotal),
        taxAmount: amount(l.vatAmount),
        total: amount(l.lineTotal),
        serialNumbers: l.serialNumbers,
    };
}
