import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createTenantDefaults } from "../src/lib/tenant/defaults";

const prisma = new PrismaClient();

async function main() {
    const passwordHash = await bcrypt.hash("admin", 12);

    const tenant = await prisma.tenant.upsert({
        where: { slug: "tiptop" },
        update: {},
        create: {
            slug: "tiptop",
            name: "TipTop AutoCare",
            registrationNumber: "CC/2019/04421",
            vatNumber: "4523874",
            address1: "435 Windhoek West",
            suburb: "Windhoek West",
            city: "Windhoek",
            region: "Khomas",
            postcode: "10005",
            country: "NA",
            phone: "+264 61 234 567",
            mobile: "+264 81 576 5935",
            whatsapp: "+264 81 576 5935",
            email: "workshop@tiptop.com.na",
            settings: { bookings: { shopOpens: "07:30", shopCloses: "17:00", workHoursPerDay: 8, diaryFullAtPercent: 90 } },
        },
    });
    await createTenantDefaults(prisma, tenant.id);

    async function person(email: string, firstName: string, lastName: string, mobile: string, group: "OWNER" | "ADMIN" | "SERVICE_ADVISOR" | "MECHANIC", flags: Partial<{ isMechanic: boolean; isServiceAdvisor: boolean; showOnDiary: boolean }>) {
        const user = await prisma.user.upsert({
            where: { email },
            update: {},
            create: { email, passwordHash, firstName, lastName, mobile },
        });
        return prisma.membership.upsert({
            where: { userId_tenantId: { userId: user.id, tenantId: tenant.id } },
            update: {},
            create: { userId: user.id, tenantId: tenant.id, group, dashboardPrivileges: group !== "MECHANIC", ...flags },
        });
    }
    await person("admin@motion.com", "Gaus", "Abner", "+264 81 576 5935", "OWNER", { isServiceAdvisor: true });
    await person("advisor@tiptop.com.na", "Nadia", "Shikongo", "+264 81 222 1010", "SERVICE_ADVISOR", { isServiceAdvisor: true });
    await person("mike@tiptop.com.na", "Mike", "Hamutenya", "+264 81 333 2020", "MECHANIC", { isMechanic: true, showOnDiary: true });
    await person("sara@tiptop.com.na", "Sara", "Nangolo", "+264 81 444 3030", "MECHANIC", { isMechanic: true, showOnDiary: true });

    const sources = await prisma.customerSource.findMany({ where: { tenantId: tenant.id } });
    const src = (name: string) => sources.find((s) => s.name.startsWith(name))?.id;

    const customers = [
        { firstName: "Cash", lastName: "Sale", mobile: null, phone: null, email: null, source: undefined },
        { firstName: "Courtney", lastName: "Farrell", mobile: "+264 81 744 4912", phone: "+264 61 282 388", email: "courtney.farrell@gmail.com", source: "Referral" },
        { firstName: "Gugulethu", lastName: "Mokwena", mobile: "+264 81 900 0829", phone: "+264 61 605 9542", email: "g.mokwena@outlook.com", source: "Google" },
        { firstName: "Jennifer", lastName: "Zondo", mobile: "+264 81 223 7541", phone: null, email: "jzondo@iway.na", source: "Walk-in" },
        { firstName: "Keanu", lastName: "Minnaar", mobile: "+264 81 576 1142", phone: "+264 61 440 3394", email: "keanu.m@gmail.com", source: "Social" },
        { firstName: "Kimberley", lastName: "Zondi", mobile: "+264 81 603 9911", phone: null, email: null, source: "Walk-in" },
        { firstName: "Nicole", lastName: "Crous", mobile: "+264 81 961 8027", phone: "+264 61 908 0331", email: "nicole.crous@mweb.com.na", source: "Referral" },
        { firstName: "Sameera", lastName: "Moses", mobile: "+264 81 260 0869", phone: null, email: "sameera.moses@gmail.com", source: "Facebook" },
        { firstName: "Sylvester", lastName: "Zuma", mobile: "+264 81 973 5056", phone: "+264 61 505 1789", email: null, source: "Fleet" },
    ];
    for (const c of customers) {
        const existing = await prisma.customer.findFirst({ where: { tenantId: tenant.id, firstName: c.firstName, lastName: c.lastName } });
        if (existing) continue;
        await prisma.customer.create({
            data: {
                tenantId: tenant.id,
                firstName: c.firstName,
                lastName: c.lastName,
                mobile: c.mobile,
                phone: c.phone,
                email: c.email,
                preferredContact: c.mobile ? "WHATSAPP" : "EMAIL",
                customerSourceId: c.source ? src(c.source) : undefined,
                streetCity: "Windhoek",
                streetRegion: "Khomas",
                streetCountry: "NA",
            },
        });
    }

    const byName = async (first: string) => (await prisma.customer.findFirst({ where: { tenantId: tenant.id, firstName: first } }))!;
    const vehicles = [
        { owner: "Courtney", plate: "N 12345 W", make: "Toyota", model: "Hilux 2.8 GD-6", year: 2021, vin: "AHTKB3CD802345671", fuelType: "Diesel", odometer: 84210, licence: "2027-03-31", roadworthy: null },
        { owner: "Gugulethu", plate: "N 88210 W", make: "Volkswagen", model: "Polo Vivo 1.4", year: 2019, vin: "AAVZZZ6RZKU012345", fuelType: "Petrol", odometer: 61500, licence: "2026-11-30", roadworthy: null },
        { owner: "Jennifer", plate: "N 4521 WB", make: "Ford", model: "Ranger 2.2 XL", year: 2017, vin: "MNAUMEF50HW123456", fuelType: "Diesel", odometer: 142300, licence: "2026-09-30", roadworthy: "2026-09-30" },
        { owner: "Keanu", plate: "N 7010 W", make: "BMW", model: "320i F30", year: 2016, vin: "WBA3B1C50FK123456", fuelType: "Petrol", odometer: 118900, licence: "2027-01-31", roadworthy: null },
        { owner: "Nicole", plate: "N 31177 W", make: "Hyundai", model: "i20 1.2 Motion", year: 2022, vin: "MALB841CANM123456", fuelType: "Petrol", odometer: 23400, licence: "2027-05-31", roadworthy: null },
        { owner: "Sylvester", plate: "N 9008 WK", make: "Isuzu", model: "D-Max 250 HO", year: 2020, vin: "MPATFS86JLT123456", fuelType: "Diesel", odometer: 97600, licence: "2026-10-31", roadworthy: "2026-10-31", fleetCode: "ZUMA-04" },
        { owner: "Sylvester", plate: "N 9009 WK", make: "Isuzu", model: "D-Max 250 HO", year: 2020, vin: "MPATFS86JLT123457", fuelType: "Diesel", odometer: 101200, licence: "2026-10-31", roadworthy: "2026-10-31", fleetCode: "ZUMA-05" },
    ];
    for (const v of vehicles) {
        const existing = await prisma.vehicle.findFirst({ where: { tenantId: tenant.id, plate: v.plate } });
        if (existing) continue;
        const owner = await byName(v.owner);
        await prisma.vehicle.create({
            data: {
                tenantId: tenant.id,
                customerId: owner.id,
                plate: v.plate,
                vin: v.vin,
                make: v.make,
                model: v.model,
                year: v.year,
                fuelType: v.fuelType,
                odometer: v.odometer,
                fleetCode: v.fleetCode,
                licenceExpiry: v.licence ? new Date(v.licence) : null,
                roadworthyExpiry: v.roadworthy ? new Date(v.roadworthy) : null,
                serviceIntervalMonths: 6,
            },
        });
    }

    for (const supplier of [
        { companyName: "Autoparts Namibia", accountNumber: "TIPTOP01", city: "Windhoek", phone: "+264 61 234 100", email: "orders@autoparts.com.na", paymentTermsDays: 30 },
        { companyName: "Tyre Rack Windhoek", accountNumber: "TR-118", city: "Windhoek", phone: "+264 61 234 200", email: "sales@tyrerack.com.na", paymentTermsDays: 30 },
        { companyName: "Lubricants & Filters CC", accountNumber: "LF-22", city: "Okahandja", phone: "+264 62 501 900", email: "accounts@lubefilters.com.na", paymentTermsDays: 14 },
    ]) {
        const existing = await prisma.supplier.findFirst({ where: { tenantId: tenant.id, companyName: supplier.companyName }, select: { id: true } });
        if (!existing) await prisma.supplier.create({ data: { tenantId: tenant.id, ...supplier } });
    }

    const groups = await prisma.productGroup.findMany({ where: { tenantId: tenant.id } });
    const g = (name: string) => groups.find((x) => x.name === name)?.id;
    const cats = await prisma.productCategory.findMany({ where: { tenantId: tenant.id } });
    const cat = (name: string) => cats.find((x) => x.name === name)?.id;
    const products = [
        { itemCode: "LAB-STD", description: "Labour – standard hourly rate", type: "LABOUR", group: "Service", category: "Labour", isService: true, retail: 650, cost: 0 },
        { itemCode: "LAB-DIAG", description: "Diagnostic scan", type: "LABOUR", group: "Repair", category: "Labour", isService: true, retail: 450, cost: 0 },
        { itemCode: "SVC-MINOR", description: "Minor service (oil & filter)", type: "LABOUR", group: "Service", category: "Labour", isService: true, retail: 950, cost: 0 },
        { itemCode: "OIL-5W30-5L", description: "Engine oil 5W-30 fully synthetic 5 L", type: "STOCK", group: "Oils & fluids", category: "Parts", retail: 685, cost: 468, qty: 24 },
        { itemCode: "FLT-OIL-TOY", description: "Oil filter – Toyota Hilux 2.8", type: "STOCK", group: "Filters", category: "Parts", retail: 185, cost: 112, qty: 8 },
        { itemCode: "FLT-AIR-POLO", description: "Air filter – VW Polo 1.4", type: "STOCK", group: "Filters", category: "Parts", retail: 240, cost: 151, qty: 5 },
        { itemCode: "BRK-PAD-F-HILUX", description: "Brake pads front – Hilux", type: "STOCK", group: "Brakes", category: "Parts", retail: 890, cost: 545, qty: 4 },
        { itemCode: "BK01", description: "Brake pads remove & replace (per axle)", type: "LABOUR", group: "Brakes", category: "Labour", isService: true, retail: 780, cost: 0 },
        { itemCode: "TYR-265-65-17", description: "Tyre 265/65 R17 AT", type: "TYRE", group: "Tyres", category: "Parts", retail: 2450, cost: 1780, qty: 6, requiresSerial: true },
        { itemCode: "SUB-ALIGN", description: "Wheel alignment (sublet – Tyre Rack)", type: "SUBLET", group: "Sublets", category: "Labour", retail: 550, cost: 380 },
        { itemCode: "CON-SHOP", description: "Shop consumables", type: "CONSUMABLE", group: "Misc", category: "Consumables", retail: 85, cost: 30, dontUpdateQty: true },
    ] as const;
    for (const p of products) {
        await prisma.product.upsert({
            where: { tenantId_itemCode: { tenantId: tenant.id, itemCode: p.itemCode } },
            update: {},
            create: {
                tenantId: tenant.id,
                itemCode: p.itemCode,
                description: p.description,
                type: p.type,
                groupId: g(p.group),
                categoryId: cat(p.category),
                isService: "isService" in p ? p.isService : false,
                requiresSerial: "requiresSerial" in p ? p.requiresSerial : false,
                dontUpdateQty: "dontUpdateQty" in p ? p.dontUpdateQty : false,
                retailPrice: p.retail,
                costExTax: p.cost,
                costIncTax: Math.round(p.cost * 1.15 * 100) / 100,
                qtyOnHand: 0,
            },
        });
        // Stock arrives through the ledger, never as a number typed on the product:
        // that is what lets it be rebuilt and explained later.
        const opening = "qty" in p ? p.qty : 0;
        if (opening) {
            const product = await prisma.product.findFirstOrThrow({ where: { tenantId: tenant.id, itemCode: p.itemCode }, select: { id: true, qtyOnHand: true } });
            const already = await prisma.stockMovement.count({ where: { productId: product.id } });
            if (already === 0) {
                await prisma.stockMovement.create({
                    data: { tenantId: tenant.id, productId: product.id, kind: "OPENING", quantity: opening, unitCost: p.cost, note: "Opening stock" },
                });
                await prisma.product.update({ where: { id: product.id }, data: { qtyOnHand: opening } });
            }
        }
    }

    console.log(`Seeded workshop "${tenant.name}" (/${tenant.slug}) — sign in as admin@motion.com / admin`);
}

main()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
