import { randomBytes } from "node:crypto";
import { test as base, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

/**
 * A workshop of its own for each test.
 *
 * Every spec makes its own tenant, its own owner and its own password — one
 * this file invents and nothing else ever sees. No seeded account is used and
 * no real credential appears anywhere in the suite, which also means the specs
 * can run in parallel without treading on each other's books.
 *
 * Everything is removed afterwards, including when the test fails, because a
 * database that fills up with half-finished workshops stops being a place you
 * can trust a test result from.
 */

const prisma = new PrismaClient();

export type Workshop = {
    slug: string;
    name: string;
    email: string;
    password: string;
    tenantId: string;
    customer: { id: string; name: string };
    vehicle: { id: string; plate: string };
    product: { id: string; itemCode: string; description: string; price: string };
};

const unique = () => randomBytes(6).toString("hex");

async function createWorkshop(): Promise<Workshop> {
    const id = unique();
    const slug = `zztest-${id}`;
    const password = `zz-${randomBytes(12).toString("base64url")}`;

    const tenant = await prisma.tenant.create({
        data: {
            slug,
            name: `ZZTEST ${id} Motors`,
            country: "NA",
            timezone: "Africa/Windhoek",
            currency: "NAD",
            taxName: "VAT",
            salesTaxRate: "15.00",
            purchaseTaxRate: "15.00",
        },
        select: { id: true },
    });

    const user = await prisma.user.create({
        data: {
            email: `${slug}@example.invalid`,
            passwordHash: await bcrypt.hash(password, 10),
            firstName: "ZZTEST",
            lastName: "Owner",
        },
        select: { id: true },
    });
    await prisma.membership.create({
        data: { tenantId: tenant.id, userId: user.id, group: "OWNER", isServiceAdvisor: true, dashboardPrivileges: true },
    });

    // The numbering a workshop would have been given when it signed up.
    await prisma.sequence.createMany({
        data: [
            { tenantId: tenant.id, key: "QUOTE", prefix: "Q-", next: 1001 },
            { tenantId: tenant.id, key: "JOB", prefix: "JC-", next: 1001 },
            { tenantId: tenant.id, key: "INVOICE", prefix: "INV-", next: 1001 },
            { tenantId: tenant.id, key: "CREDIT", prefix: "CR-", next: 1001 },
            { tenantId: tenant.id, key: "RECEIPT", prefix: "RC-", next: 1001 },
        ],
    });
    await prisma.paymentMethod.create({ data: { tenantId: tenant.id, name: "Cash", code: "CASH", sortOrder: 1 } });

    const customer = await prisma.customer.create({
        data: { tenantId: tenant.id, firstName: "Anna", lastName: "Shilongo", mobile: "+264815556677", email: "anna@example.invalid" },
        select: { id: true },
    });
    const vehicle = await prisma.vehicle.create({
        data: { tenantId: tenant.id, customerId: customer.id, plate: `N ${id.slice(0, 4).toUpperCase()} W`, make: "Toyota", model: "Hilux 2.8 GD-6", year: 2021, odometer: 88_000 },
        select: { id: true, plate: true },
    });
    const product = await prisma.product.create({
        data: {
            tenantId: tenant.id,
            itemCode: "LAB-1",
            description: "Workshop labour",
            type: "LABOUR",
            isService: true,
            retailPrice: "650.00",
            costExTax: "0.00",
        },
        select: { id: true, itemCode: true, description: true },
    });

    return {
        slug,
        name: `ZZTEST ${id} Motors`,
        email: `${slug}@example.invalid`,
        password,
        tenantId: tenant.id,
        customer: { id: customer.id, name: "Anna Shilongo" },
        vehicle: { id: vehicle.id, plate: vehicle.plate },
        product: { id: product.id, itemCode: product.itemCode, description: product.description, price: "650.00" },
    };
}

/** Children first: the schema keeps real foreign keys, so a workshop comes apart in order. */
async function removeWorkshop(tenantId: string, email: string): Promise<void> {
    const where = { tenantId };
    await prisma.paymentAllocation.deleteMany({ where });
    await prisma.paymentTender.deleteMany({ where });
    await prisma.payment.deleteMany({ where });
    await prisma.message.deleteMany({ where });
    await prisma.shareLink.deleteMany({ where });
    await prisma.stockMovement.deleteMany({ where });
    await prisma.timeEntry.deleteMany({ where });
    await prisma.documentStatusEvent.deleteMany({ where });
    await prisma.documentLine.deleteMany({ where });
    await prisma.document.deleteMany({ where });
    await prisma.vehicle.deleteMany({ where });
    await prisma.customer.deleteMany({ where });
    await prisma.product.deleteMany({ where });
    await prisma.paymentMethod.deleteMany({ where });
    await prisma.sequence.deleteMany({ where });
    await prisma.template.deleteMany({ where });
    await prisma.auditEvent.deleteMany({ where });
    await prisma.session.deleteMany({ where: { tenantId } });
    await prisma.membership.deleteMany({ where });
    await prisma.tenant.delete({ where: { id: tenantId } });
    await prisma.user.deleteMany({ where: { email } });
}

export const test = base.extend<{ workshop: Workshop }>({
    workshop: async ({}, use) => {
        const workshop = await createWorkshop();
        try {
            await use(workshop);
        } finally {
            await removeWorkshop(workshop.tenantId, workshop.email);
        }
    },
});

export { expect } from "@playwright/test";

/** Sign in through the real form, because that is the path a person takes. */
export async function signIn(page: Page, workshop: Workshop): Promise<void> {
    await page.goto("/login");
    await page.getByLabel("Email").fill(workshop.email);
    await page.getByLabel("Password").fill(workshop.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(`**/${workshop.slug}/dashboard**`);
}

/**
 * Raise an invoice for the fixture's customer and car, and process it.
 *
 * The steps a service advisor takes, in the order they take them, kept here so
 * a test that cares about what happens *after* an invoice exists does not have
 * to restate how one is made.
 */
export async function raiseAndProcessInvoice(page: Page, workshop: Workshop, amount = "650"): Promise<void> {
    await page.goto(`/${workshop.slug}/dashboard/transactions`);
    await page.getByRole("button", { name: "Invoice" }).click();
    await page.waitForURL("**/documents/**");

    await page.getByPlaceholder("Name, mobile, email or plate…").fill("Anna");
    await page.getByRole("option", { name: /Shilongo, Anna/ }).first().click();

    await page.getByRole("combobox", { name: "Vehicle" }).click();
    await page
        .getByRole("listbox", { name: "Vehicle" })
        .getByRole("option", { name: new RegExp(workshop.vehicle.plate.replace(/ /g, "\\s*"), "i") })
        .first()
        .click();

    await page.getByRole("button", { name: "Add line" }).click();
    await page.getByLabel("Description, line 1").fill("Minor service (oil & filter)");
    await page.getByLabel("Quantity, line 1").fill("1");
    await page.getByLabel("Unit price, line 1").fill(amount);
    await page.getByRole("button", { name: "Save" }).click();

    await page.getByRole("button", { name: "Process", exact: true }).click();
    await page.getByRole("textbox", { name: /^Odometer/ }).fill("88500");
    await page.getByRole("button", { name: "Process invoice" }).click();
}

/**
 * What the books actually say about a document.
 *
 * The screens are what the test drives, but the question "is this invoice
 * settled" is answered by the ledger, not by a cell of text — and paid is
 * derived from allocations, never stored, so this reads it the way the app
 * does.
 */
export async function bookEntry(tenantId: string, number: string): Promise<{ state: string; total: string; paid: string }> {
    const document = await prisma.document.findFirstOrThrow({
        where: { tenantId, number },
        select: {
            state: true,
            total: true,
            allocations: { where: { payment: { state: "PROCESSED" } }, select: { amount: true } },
        },
    });
    const paid = document.allocations.reduce((sum, a) => sum + Number(a.amount), 0);
    return { state: document.state, total: Number(document.total).toFixed(2), paid: paid.toFixed(2) };
}
