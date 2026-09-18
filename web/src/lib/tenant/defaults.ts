import type { Prisma, PrismaClient } from "@prisma/client";

type Tx = Prisma.TransactionClient | PrismaClient;

/**
 * Lists, sequences and templates every new workshop starts with (PRD SET-06/07/08).
 * Shared by registration and the seed. Idempotent per tenant.
 */
export async function createTenantDefaults(tx: Tx, tenantId: string) {
    await tx.sequence.createMany({
        skipDuplicates: true,
        data: [
            { tenantId, key: "QUOTE", prefix: "Q-", next: 1001 },
            { tenantId, key: "JOB", prefix: "JC-", next: 1001 },
            { tenantId, key: "INVOICE", prefix: "INV-", next: 1001 },
            { tenantId, key: "CREDIT", prefix: "CR-", next: 1001 },
            { tenantId, key: "RECEIPT", prefix: "RC-", next: 1001 },
            { tenantId, key: "REFUND", prefix: "RF-", next: 1001 },
            { tenantId, key: "PURCHASE_ORDER", prefix: "PO-", next: 1001 },
            { tenantId, key: "SUPPLIER_PAYMENT", prefix: "SP-", next: 1001 },
        ],
    });

    await tx.paymentMethod.createMany({
        skipDuplicates: true,
        data: [
            { tenantId, name: "Cash", code: "CASH", sortOrder: 1 },
            { tenantId, name: "Card", code: "CARD", sortOrder: 2 },
            { tenantId, name: "EFT", code: "EFT", isEft: true, sortOrder: 3 },
            { tenantId, name: "PayToday", code: "PAYTODAY", sortOrder: 4 },
            { tenantId, name: "Account", code: "ACCOUNT", sortOrder: 5 },
        ],
    });

    await tx.customerSource.createMany({
        skipDuplicates: true,
        data: ["Walk-in", "Referral – word of mouth", "Google search", "Social media", "Facebook / WhatsApp group", "Fleet contract", "Radio / print"].map(
            (name, i) => ({ tenantId, name, sortOrder: i + 1 }),
        ),
    });

    await tx.productGroup.createMany({
        skipDuplicates: true,
        data: ["Service", "Repair", "Oils & fluids", "Filters", "Brakes", "Tyres", "Sublets", "Misc"].map((name, i) => ({ tenantId, name, sortOrder: i + 1 })),
    });

    await tx.productCategory.createMany({
        skipDuplicates: true,
        data: ["Parts", "Labour", "Consumables", "Accessories"].map((name, i) => ({ tenantId, name, sortOrder: i + 1 })),
    });

    await tx.appointmentType.createMany({
        skipDuplicates: true,
        data: [
            { tenantId, description: "Minor service", estimatedHours: 1.5, sortOrder: 1 },
            { tenantId, description: "Major service", estimatedHours: 3, sortOrder: 2 },
            { tenantId, description: "Brakes", estimatedHours: 2, sortOrder: 3 },
            { tenantId, description: "Diagnostics", estimatedHours: 1, sortOrder: 4 },
            { tenantId, description: "Roadworthy inspection", estimatedHours: 1, sortOrder: 5 },
            { tenantId, description: "Tyres & alignment", estimatedHours: 1.5, sortOrder: 6 },
        ],
    });

    // Footers and document messages are not seeded: they fall back to the built-in
    // wording in lib/templates/catalogue.ts, so a workshop that never edits them
    // picks up every improvement to it. Only picklist notes and reminders live here.
    const existingTemplates = await tx.template.count({ where: { tenantId } });
    if (existingTemplates === 0) {
        await tx.template.createMany({
            data: [
                { tenantId, kind: "INVOICE_NOTE", name: "Next service", body: "Next service due at {{next_service_km}} km or {{next_service_date}}, whichever comes first." },
                { tenantId, kind: "JOB_CARD_NOTE", name: "Standard checks", body: "Check tyre pressures, all lights, wipers and fluid levels. Note any advisories for the customer." },
                { tenantId, kind: "SMS", name: "Vehicle ready", body: "Hi {{customer_first_name}}, your {{vehicle}} ({{plate}}) is ready for collection at {{workshop_name}}. Total {{total}}." },
                { tenantId, kind: "SMS", name: "Booking confirmation", body: "Hi {{customer_first_name}}, your booking at {{workshop_name}} is confirmed for {{scheduled_at}}. Reply to change." },
            ],
        });
    }
}
