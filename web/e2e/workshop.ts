import { randomBytes } from "node:crypto";
import { test as base, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { announceTenant } from "@/lib/tenant-db";

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

    /**
     * Everything from here is tenant-owned, and row-level security is live —
     * these tests run against the same restricted role the application uses, so
     * a fixture that could not build a workshop would be telling us something
     * real about registration rather than something inconvenient about testing.
     *
     * One transaction that names the tenant first, exactly as registering a
     * workshop does. Reaching for an administrative connection here would have
     * quietly excused the tests from the rules the application lives under.
     */
    const seeded = await prisma.$transaction(async (tx) => {
        await announceTenant(tx, tenant.id);

        await tx.membership.create({
            data: { tenantId: tenant.id, userId: user.id, group: "OWNER", isServiceAdvisor: true, dashboardPrivileges: true },
        });

        // The numbering a workshop would have been given when it signed up.
        await tx.sequence.createMany({
            data: [
                { tenantId: tenant.id, key: "QUOTE", prefix: "Q-", next: 1001 },
                { tenantId: tenant.id, key: "JOB", prefix: "JC-", next: 1001 },
                { tenantId: tenant.id, key: "INVOICE", prefix: "INV-", next: 1001 },
                { tenantId: tenant.id, key: "CREDIT", prefix: "CR-", next: 1001 },
                { tenantId: tenant.id, key: "RECEIPT", prefix: "RC-", next: 1001 },
            ],
        });
        await tx.paymentMethod.create({ data: { tenantId: tenant.id, name: "Cash", code: "CASH", sortOrder: 1 } });

        const customer = await tx.customer.create({
            data: { tenantId: tenant.id, firstName: "Anna", lastName: "Shilongo", mobile: "+264815556677", email: "anna@example.invalid" },
            select: { id: true },
        });
        const vehicle = await tx.vehicle.create({
            data: { tenantId: tenant.id, customerId: customer.id, plate: `N ${id.slice(0, 4).toUpperCase()} W`, make: "Toyota", model: "Hilux 2.8 GD-6", year: 2021, odometer: 88_000 },
            select: { id: true, plate: true },
        });
        const product = await tx.product.create({
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
        return { customer, vehicle, product };
    });
    const { customer, vehicle, product } = seeded;

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
/**
 * Take the workshop away again.
 *
 * In one transaction that names the tenant, for a reason worth knowing: under
 * row-level security an unscoped `deleteMany` does not fail, it matches nothing
 * and reports success. The first version of this left every row in place and
 * only gave itself away three statements later, when deleting the tenant hit a
 * foreign key. Anything that deletes by tenant has to say which tenant.
 */
async function removeWorkshop(tenantId: string, email: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
        await announceTenant(tx, tenantId);
        const where = { tenantId };
        await tx.paymentAllocation.deleteMany({ where });
        await tx.paymentTender.deleteMany({ where });
        await tx.payment.deleteMany({ where });
        await tx.message.deleteMany({ where });
        await tx.shareLink.deleteMany({ where });
        await tx.stockMovement.deleteMany({ where });
        await tx.timeEntry.deleteMany({ where });
        await tx.documentStatusEvent.deleteMany({ where });
        await tx.documentLine.deleteMany({ where });
        await tx.document.deleteMany({ where });
        await tx.vehicle.deleteMany({ where });
        await tx.customer.deleteMany({ where });
        await tx.product.deleteMany({ where });
        await tx.paymentMethod.deleteMany({ where });
        await tx.sequence.deleteMany({ where });
        await tx.template.deleteMany({ where });
        await tx.passwordReset.deleteMany({ where });
        await tx.auditEvent.deleteMany({ where });
        await tx.session.deleteMany({ where });
        await tx.membership.deleteMany({ where });
        await tx.tenant.delete({ where: { id: tenantId } });
    });
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
    // Announced, like every other read of tenant-owned rows. Without it
    // row-level security returns nothing and this reports "no such invoice"
    // for an invoice that is sitting right there — which reads as the money
    // path being broken rather than the query being unscoped.
    return prisma.$transaction(async (tx) => {
        await announceTenant(tx, tenantId);
        const document = await tx.document.findFirstOrThrow({
            where: { tenantId, number },
            select: {
                state: true,
                total: true,
                allocations: { where: { payment: { state: "PROCESSED" } }, select: { amount: true } },
            },
        });
        const paid = document.allocations.reduce((sum, a) => sum + Number(a.amount), 0);
        return { state: document.state, total: Number(document.total).toFixed(2), paid: paid.toFixed(2) };
    });
}

/**
 * Enough customers that the list actually scrolls.
 *
 * A test about keeping your place in a long list proves nothing against a list
 * of one, which is what the fixture builds by default.
 */
export async function addCustomers(tenantId: string, count: number): Promise<void> {
    await prisma.$transaction(async (tx) => {
        await announceTenant(tx, tenantId);
        await tx.customer.createMany({
            data: Array.from({ length: count }, (_, i) => ({
                tenantId,
                firstName: "ZZTEST",
                lastName: `Filler ${String(i + 1).padStart(2, "0")}`,
                mobile: `+2648100000${String(i).padStart(2, "0")}`,
            })),
        });
    });
}
