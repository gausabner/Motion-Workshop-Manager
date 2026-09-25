import "server-only";
import type { Tenant } from "@prisma/client";
import type { Membership } from "@prisma/client";
import type { TenantDb } from "@/lib/tenant-db";
import type { Section } from "@/lib/pdf/register";
import { col, countRows, dec, hours, int, iso, percent, type Register } from "@/lib/exports/kit";
import { marginReport } from "@/lib/stock/reports";
import { stockValuation } from "@/lib/stock/valuation";
import { getStockTake } from "@/lib/stock/stocktake-service";
import { variance as lineVariance } from "@/lib/stock/stocktake";
import { labourReport } from "@/lib/time/queries";
import { payablesReport } from "@/lib/purchasing/payments";
import { workInProgress } from "@/lib/documents/wip";
import { quoteOutcomes } from "@/lib/documents/quotes";
import { renewalsDue } from "@/lib/vehicles/renewals";
import { customerListing } from "@/lib/customers/listing";
import { vehicleListing } from "@/lib/vehicles/listing";
import { redactContactAll } from "@/lib/auth/redact";
import { AGEING_BUCKETS, AGEING_LABELS } from "@/lib/payments/allocation";

/**
 * The exports an owner decides with.
 *
 * Where the audit six answer "can you prove this", these answer "what should I
 * do about it" — which is why almost all of them are ranked rather than
 * chronological, and why the PDF matters less here than it does there. An
 * auditor files a register; an owner sorts a spreadsheet. Both are produced
 * anyway, from the same definition, because the cost of the second one is a
 * line in a route and the cost of them disagreeing is a lost afternoon.
 *
 * Two of these are not really owner reports at all. Work in progress is
 * unbilled revenue at a period end, which is an auditor's question wearing an
 * owner's clothes, and the customer listing is the data-portability answer —
 * the file a workshop is handed when it asks whether it can get its own
 * customers back out.
 */

export const BUSINESS_REPORTS = [
    "profit", "items", "wip", "quotes", "labour",
    "creditors", "stock", "stocktake", "renewals", "customers", "vehicles",
] as const;
export type BusinessReport = (typeof BUSINESS_REPORTS)[number];

export const BUSINESS_TITLES: Record<BusinessReport, string> = {
    profit: "Profit by job",
    items: "Item sales",
    wip: "Work in progress",
    quotes: "Quote outcomes",
    labour: "Mechanic time",
    creditors: "Creditors age analysis",
    stock: "Stock valuation",
    stocktake: "Stocktake variance",
    renewals: "Renewals due",
    customers: "Customer listing",
    vehicles: "Vehicle listing",
};

/** Which reports are about a period, and which are a picture of right now. */
export const AS_AT_REPORTS: BusinessReport[] = ["wip", "creditors", "stock", "stocktake", "customers", "vehicles"];

// -- Money ------------------------------------------------------------------

export async function profitRegister(db: TenantDb, tenant: Tenant, from: Date, to: Date): Promise<Register> {
    const report = await marginReport(db, tenant, from, to);
    const c = tenant.currency;

    const sections: Section[] = [{
        columns: [
            col("number", "Number", 62), col("who", "Customer and vehicle", 150, "left", true),
            col("qty", "Lines", 40, "right"),
            col("sales", `Sales (${c})`, 75, "right"), col("cost", `Cost (${c})`, 70, "right"),
            col("profit", `Profit (${c})`, 66.28, "right"), col("percent", "Margin", 48, "right"),
        ],
        rows: report.jobs.map((j) => ({
            number: j.label, who: j.sub ?? "", qty: dec(j.quantity),
            sales: dec(j.margin.sales), cost: dec(j.margin.cost),
            profit: dec(j.margin.profit), percent: percent(j.margin.percent),
        })),
        empty: "Nothing was invoiced in this period.",
    }];

    const losing = report.jobs.filter((j) => j.margin.profit < 0).length;

    return {
        title: BUSINESS_TITLES.profit,
        rows: countRows(sections),
        sections,
        totals: [
            { label: `Sales (${c})`, value: dec(report.totals.sales) },
            { label: `Cost (${c})`, value: dec(report.totals.cost) },
            { label: `Profit (${c})`, value: dec(report.totals.profit), strong: true },
            { label: "Margin", value: percent(report.totals.percent) },
        ],
        notes: [
            "Ranked by what each job made, best first. Sales and cost both exclude tax, and a credit note comes off both sides.",
            losing > 0 ? `${losing} job${losing === 1 ? "" : "s"} in this period cost more than ${losing === 1 ? "it" : "they"} brought in.` : "",
            report.missingCost > 0
                ? `${report.missingCost} part line${report.missingCost === 1 ? " was" : "s were"} sold with no cost recorded, so the profit above is flattered by however much those parts actually cost.`
                : "",
            "Internal jobs are excluded: work the workshop does on its own vehicles is not a sale.",
        ].filter(Boolean),
    };
}

export async function itemsRegister(db: TenantDb, tenant: Tenant, from: Date, to: Date): Promise<Register> {
    const report = await marginReport(db, tenant, from, to);
    const c = tenant.currency;

    const columns = (first: string, firstWidth: number, subWidth: number) => [
        col("label", first, firstWidth), col("sub", "Detail", subWidth, "left", true),
        col("qty", "Qty", 40, "right"),
        col("sales", `Sales (${c})`, 75, "right"), col("cost", `Cost (${c})`, 70, "right"),
        col("profit", `Profit (${c})`, 66.28, "right"), col("percent", "Margin", 48, "right"),
    ];
    const asRows = (rows: typeof report.products) =>
        rows.map((r) => ({
            label: r.label, sub: r.sub ?? "", qty: dec(r.quantity),
            sales: dec(r.margin.sales), cost: dec(r.margin.cost),
            profit: dec(r.margin.profit), percent: percent(r.margin.percent),
        }));

    const sections: Section[] = [
        { heading: "By product", columns: columns("Item code", 110, 102), rows: asRows(report.products), empty: "Nothing was sold in this period." },
        { heading: "By group", columns: columns("Group", 150, 62), rows: asRows(report.byGroup), empty: "Nothing was sold in this period." },
        { heading: "By supplier", columns: columns("Supplier", 150, 62), rows: asRows(report.bySupplier), empty: "Nothing was sold in this period." },
        { heading: "By kind of line", columns: columns("Kind", 150, 62), rows: asRows(report.byType), empty: "Nothing was sold in this period." },
    ];

    return {
        title: BUSINESS_TITLES.items,
        rows: countRows(sections),
        sections,
        totals: [
            { label: `Sales (${c})`, value: dec(report.totals.sales) },
            { label: `Cost (${c})`, value: dec(report.totals.cost) },
            { label: `Profit (${c})`, value: dec(report.totals.profit), strong: true },
        ],
        notes: [
            "The same sales, cut four ways. Each section totals to the same figure, so a group that looks wrong can be traced to the products under it.",
            "A line typed in by hand rather than picked from the catalogue has no group and no supplier, and is counted under “Ungrouped” and “No supplier” rather than dropped.",
        ],
    };
}

export async function wipRegister(db: TenantDb, tenant: Tenant, asAt: Date): Promise<Register> {
    const wip = await workInProgress(db, asAt);
    const c = tenant.currency;

    const summary: Section = {
        heading: "By status",
        columns: [col("status", "Status", 220), col("jobs", "Jobs", 80, "right"), col("value", `Value (${c})`, 211.28, "right")],
        rows: wip.byStatus.map((s) => ({ status: s.status, jobs: int(s.jobs), value: dec(s.value) })),
        empty: "No open jobs.",
    };

    const detail: Section = {
        heading: "Every open job, oldest first",
        columns: [
            col("number", "Job", 60), col("opened", "Opened", 55), col("age", "Days", 32, "right"),
            col("customer", "Customer", 95), col("vehicle", "Vehicle", 100, "left", true),
            col("status", "Status", 82), col("value", `Value (${c})`, 87.28, "right"),
        ],
        rows: wip.rows.map((r) => ({
            number: r.number, opened: r.opened, age: int(r.age),
            customer: r.customer, vehicle: r.vehicle, status: r.status, value: dec(r.total),
        })),
        empty: "Nothing is open. Every job card has been invoiced.",
    };

    const empties = wip.rows.filter((r) => r.empty).length;
    const stale = wip.rows.filter((r) => r.age > 30).length;

    return {
        title: BUSINESS_TITLES.wip,
        rows: countRows([summary, detail]),
        sections: [summary, detail],
        totals: [
            { label: "Open jobs", value: int(wip.rows.length) },
            { label: `Value (${c})`, value: dec(wip.total), strong: true },
        ],
        notes: [
            "Jobs opened and not yet invoiced, as they stand. This is work done and not yet billed — at a period end it is the unbilled revenue figure an auditor asks for.",
            "The value is each job card's own total as it stands today. Lines are still being added to most of these, so it is an estimate of what they will bill, not money anybody owes yet.",
            stale > 0 ? `${stale} job${stale === 1 ? " has" : "s have"} been open more than 30 days.` : "",
            empties > 0 ? `${empties} open job${empties === 1 ? " has" : "s have"} nothing on ${empties === 1 ? "it" : "them"} at all, so ${empties === 1 ? "its" : "their"} value is nil rather than unknown.` : "",
        ].filter(Boolean),
    };
}

export async function quotesRegister(db: TenantDb, tenant: Tenant, from: Date, to: Date): Promise<Register> {
    const q = await quoteOutcomes(db, from, to);
    const c = tenant.currency;

    const summary: Section = {
        heading: "Outcomes",
        columns: [col("outcome", "Outcome", 220), col("count", "Quotes", 80, "right"), col("value", `Value (${c})`, 211.28, "right")],
        rows: (["Won", "Open", "Lost", "Cancelled"] as const).map((o) => ({ outcome: o, count: int(q.counts[o]), value: dec(q.values[o]) })),
    };

    const detail: Section = {
        heading: "Every quote",
        columns: [
            col("number", "Number", 58), col("date", "Date", 55), col("customer", "Customer", 105),
            col("vehicle", "Vehicle", 60, "left", true), col("outcome", "Outcome", 60),
            col("became", "Became", 60, "left", true), col("days", "Days", 30, "right"),
            col("total", `Value (${c})`, 83.28, "right"),
        ],
        rows: q.rows.map((r) => ({
            number: r.number, date: r.date, customer: r.customer, vehicle: r.vehicle,
            outcome: r.outcome, became: r.becameNumber, days: r.daysToWin === null ? "" : int(r.daysToWin),
            total: dec(r.total),
        })),
        empty: "No quotes were raised in this period.",
    };

    return {
        title: BUSINESS_TITLES.quotes,
        rows: countRows([summary, detail]),
        sections: [summary, detail],
        totals: [
            { label: `Quoted (${c})`, value: dec(q.quoted) },
            { label: `Won (${c})`, value: dec(q.values.Won) },
            { label: "Conversion by value", value: percent(q.conversionByValue), strong: true },
            { label: "Conversion by count", value: percent(q.conversionByCount) },
        ],
        notes: [
            "A quote counts as won when another document was raised from it, which MOTION records when the quote is converted. It is not a status anybody sets by hand, which is why the rate can be trusted.",
            `A quote nobody converted is called lost once its follow-up date has passed, or ${30} days after it was raised when no follow-up date was set. Until then it is open.`,
            "A cancelled quote is left out of the conversion rate altogether: it was withdrawn rather than turned down, and counting it as a loss would make a workshop that tidies up look worse than one that does not.",
            q.averageDaysToWin !== null ? `A won quote took ${q.averageDaysToWin} days on average to be accepted.` : "",
        ].filter(Boolean),
    };
}

export async function labourRegister(db: TenantDb, tenant: Tenant, fromDay: string, toDay: string): Promise<Register> {
    const { rows, totals } = await labourReport(db, tenant, fromDay, toDay);

    const sections: Section[] = [{
        columns: [
            col("name", "Mechanic", 130), col("jobs", "Jobs", 45, "right"),
            col("worked", "Hours worked", 75, "right"), col("invoiced", "On billed jobs", 78, "right"),
            col("charged", "Hours charged", 78, "right"), col("efficiency", "Recovery", 55, "right"),
            col("pending", "Not yet billed", 50.28, "right"),
        ],
        rows: rows.map((r) => ({
            name: r.name, jobs: int(r.jobs),
            worked: hours(r.worked), invoiced: hours(r.workedInvoiced),
            charged: hours(r.charged), efficiency: percent(r.efficiency),
            pending: hours(r.workedPending),
        })),
        empty: "Nobody clocked any time in this period.",
    }];

    return {
        title: BUSINESS_TITLES.labour,
        rows: countRows(sections),
        sections,
        totals: [
            { label: "Hours worked", value: hours(totals.worked) },
            { label: "Hours charged", value: hours(totals.charged) },
            { label: "Recovery", value: percent(totals.efficiency), strong: true },
            { label: "Not yet billed", value: hours(totals.workedPending) },
        ],
        notes: [
            "Recovery compares like with like: hours charged against hours worked on jobs that have actually been invoiced. Time on unfinished work is held back under “not yet billed” so a week of open jobs does not read as a week of giving time away.",
            "Where two mechanics worked the same job, the charged hours are split between them in proportion to what each clocked.",
            totals.suspect > 0
                ? `${totals.suspect} entr${totals.suspect === 1 ? "y is" : "ies are"} an implausible length — usually a clock left running overnight — and ${totals.suspect === 1 ? "is" : "are"} worth checking before this is used for anybody's pay.`
                : "",
        ].filter(Boolean),
    };
}

export async function creditorsRegister(db: TenantDb, tenant: Tenant, asAt: Date): Promise<Register> {
    const report = await payablesReport(db, asAt);
    const c = tenant.currency;

    const bySupplier: Section = {
        heading: "By supplier",
        columns: [
            col("name", "Supplier", 135),
            ...AGEING_BUCKETS.map((b) => col(b, `${AGEING_LABELS[b]} (${c})`, 63.75, "right")),
            col("total", `Owing (${c})`, 121.28, "right"),
        ],
        rows: report.suppliers.map((s) => ({
            name: s.name,
            ...Object.fromEntries(AGEING_BUCKETS.map((b) => [b, dec(s.ageing[b])])),
            total: dec(s.total),
        })),
        empty: "Nothing is owed to any supplier.",
    };

    const detail: Section = {
        heading: "Every unpaid supplier invoice",
        columns: [
            col("supplier", "Supplier", 130), col("number", "Their number", 90),
            col("posted", "Posted", 60), col("due", "Due", 60),
            col("total", `Invoice (${c})`, 80, "right"), col("outstanding", `Outstanding (${c})`, 91.28, "right"),
        ],
        rows: report.suppliers.flatMap((s) =>
            s.invoices.map((i) => ({
                supplier: s.name, number: i.supplierNumber ?? "", posted: i.postDate, due: i.dueDate ?? "",
                total: dec(i.total), outstanding: dec(i.outstanding),
            })),
        ),
        empty: "Nothing is outstanding.",
    };

    return {
        title: BUSINESS_TITLES.creditors,
        rows: countRows([bySupplier, detail]),
        sections: [bySupplier, detail],
        totals: [
            ...AGEING_BUCKETS.map((b) => ({ label: `${AGEING_LABELS[b]} (${c})`, value: dec(report.ageing[b]) })),
            { label: `Owing (${c})`, value: dec(report.total), strong: true },
        ],
        notes: [
            `Aged from the due date, as at ${iso(asAt)}. An invoice with no due date on it is aged from the day it was posted.`,
            "Only processed supplier invoices count. A delivery note nobody has turned into an invoice is not yet a debt.",
        ],
    };
}

// -- Stock ------------------------------------------------------------------

export async function stockRegister(db: TenantDb, tenant: Tenant): Promise<Register> {
    const v = await stockValuation(db);
    const c = tenant.currency;

    const sections: Section[] = [{
        columns: [
            col("itemCode", "Item code", 80), col("description", "Description", 128),
            col("group", "Group", 65, "left", true), col("location", "Where", 45, "left", true),
            col("onHand", "On hand", 42, "right"), col("unitCost", `Cost (${c})`, 50, "right"),
            col("value", `Value (${c})`, 60, "right"), col("retail", `At retail (${c})`, 41.28, "right"),
        ],
        rows: v.rows.map((r) => ({
            itemCode: r.itemCode, description: r.description, group: r.group, location: r.location,
            onHand: dec(r.onHand), unitCost: dec(r.unitCost), value: dec(r.value), retail: dec(r.retail),
        })),
        empty: "Nothing is on hand.",
    }];

    return {
        title: BUSINESS_TITLES.stock,
        rows: countRows(sections),
        sections,
        totals: [
            { label: "Lines", value: int(v.lines) },
            { label: "Units", value: dec(v.units) },
            { label: `At retail (${c})`, value: dec(v.retail) },
            { label: `Value at cost (${c})`, value: dec(v.value), strong: true },
        ],
        notes: [
            "Valued at what the stock cost, which is the figure that belongs in a balance sheet. The retail column is what the same stock is priced at, and is not the value of anything until it sells.",
            "Cost is each product's current cost, not a weighted average of what each unit cost on the day it arrived. MOTION does not keep per-unit cost layers, and a valuation that implied otherwise would be worse than one that says which cost it used.",
            "Labour, sublet and anything marked as a service or as not stock-tracked is left out: it has no shelf to count.",
            v.negative > 0 ? `${v.negative} product${v.negative === 1 ? " is" : "s are"} showing a negative quantity, which is a counting error rather than a valuation. ${v.negative === 1 ? "It is" : "They are"} left in so ${v.negative === 1 ? "it" : "they"} can be found.` : "",
            v.noCost > 0 ? `${v.noCost} product${v.noCost === 1 ? " has" : "s have"} stock on hand and no cost recorded, and ${v.noCost === 1 ? "is" : "are"} therefore valued at nil.` : "",
        ].filter(Boolean),
    };
}

export async function stocktakeRegister(db: TenantDb, tenant: Tenant, takeId: string): Promise<Register | null> {
    const take = await getStockTake(db, takeId);
    if (!take) return null;
    const c = tenant.currency;

    const counted = take.lines.filter((l) => l.counted !== null);
    const varied = counted.filter((l) => lineVariance(l) !== 0);

    const sections: Section[] = [{
        heading: "Every line that did not agree",
        columns: [
            col("itemCode", "Item code", 85), col("description", "Description", 150),
            col("location", "Where", 50, "left", true),
            col("expected", "Expected", 50, "right"), col("counted", "Counted", 45, "right"),
            col("variance", "Out by", 45, "right"), col("value", `Value (${c})`, 86.28, "right"),
        ],
        rows: varied.map((l) => {
            const out = lineVariance(l) ?? 0;
            return {
                itemCode: l.itemCode, description: l.description, location: l.location ?? "",
                expected: dec(l.expected), counted: dec(l.counted ?? 0),
                variance: dec(out), value: dec(Math.round(out * l.unitCost * 100) / 100),
            };
        }),
        empty: "Every counted line agreed with the books.",
    }];

    const s = take.summary;

    return {
        title: `${BUSINESS_TITLES.stocktake} — ${take.number ?? "count"}`,
        rows: countRows(sections),
        sections,
        totals: [
            { label: "Lines on the sheet", value: int(s.lines) },
            { label: "Counted", value: int(s.counted) },
            { label: "Over", value: int(s.over) },
            { label: "Short", value: int(s.short) },
            { label: `Net variance (${c})`, value: dec(s.value), strong: true },
        ],
        notes: [
            `Count ${take.number ?? ""} started ${iso(take.startedAt)}${take.appliedAt ? `, applied ${iso(take.appliedAt)}` : ", not yet applied"}.`,
            s.value < 0
                ? `The shelves hold ${dec(Math.abs(s.value))} ${c} less than the books said.`
                : s.value > 0
                    ? `The shelves hold ${dec(s.value)} ${c} more than the books said.`
                    : "The shelves and the books agree.",
            s.uncounted > 0 ? `${s.uncounted} line${s.uncounted === 1 ? " was" : "s were"} never counted and ${s.uncounted === 1 ? "is" : "are"} left alone — an unfinished sheet must not write unvisited stock down to nothing.` : "",
            s.movedDuringCount > 0
                ? `${s.movedDuringCount} product${s.movedDuringCount === 1 ? "" : "s"} moved between the sheet being drawn up and the count being applied, so the adjustment posted for ${s.movedDuringCount === 1 ? "it" : "them"} differs from the variance shown here.`
                : "",
            take.blind ? "This was a blind count: what the system expected was hidden while counting." : "",
        ].filter(Boolean),
    };
}

// -- The book ---------------------------------------------------------------

export async function renewalsRegister(db: TenantDb, tenant: Tenant, from: Date, to: Date, membership: Membership): Promise<Register> {
    const due = await renewalsDue(db, from, to);
    // Exactly the redaction the customer screen applies. The export must not
    // become the way around a permission somebody was not given.
    const rows = redactContactAll(due.rows, membership);

    const sections: Section[] = [{
        columns: [
            col("due", "Due", 58), col("kind", "What", 70), col("plate", "Plate", 60),
            col("vehicle", "Vehicle", 100, "left", true), col("customer", "Customer", 95),
            col("mobile", "Mobile", 70), col("lastSeen", "Last in", 58.28, "left", true),
        ],
        csvColumns: [
            col("due", "Due", 0), col("daysAway", "Days away", 0), col("kind", "What", 0),
            col("plate", "Plate", 0), col("vehicle", "Vehicle", 0),
            col("customer", "Customer", 0), col("mobile", "Mobile", 0),
            col("phone", "Phone", 0), col("email", "Email", 0), col("lastSeen", "Last in", 0),
        ],
        rows: rows.map((r) => ({
            due: r.due, daysAway: int(r.daysAway), kind: r.kind, plate: r.plate, vehicle: r.vehicle,
            customer: r.customer, mobile: r.mobile ?? "", phone: r.phone ?? "", email: r.email ?? "",
            lastSeen: r.lastSeen,
        })),
        empty: "Nothing falls due in this window.",
    }];

    return {
        title: BUSINESS_TITLES.renewals,
        rows: countRows(sections),
        sections,
        totals: [
            { label: "Services", value: int(due.counts.Service) },
            { label: "Licence discs", value: int(due.counts["Licence disc"]) },
            { label: "Roadworthies", value: int(due.counts.Roadworthy) },
            { label: "Due in total", value: int(due.rows.length), strong: true },
        ],
        notes: [
            "Soonest first, so the file is worked through from the top. A vehicle with two dates falling in the window appears twice, once for each.",
            due.overdue > 0 ? `${due.overdue} ${due.overdue === 1 ? "date has" : "dates have"} already passed.` : "",
            "This ignores whether the matching reminder is switched on. A workshop that has turned off disc reminders has decided not to be nagged; it has not decided the dates should be unobtainable.",
        ].filter(Boolean),
    };
}

export async function customersRegister(db: TenantDb, tenant: Tenant, includeArchived: boolean, membership: Membership): Promise<Register> {
    const all = await customerListing(db, includeArchived);
    const rows = redactContactAll(all, membership);
    const c = tenant.currency;

    const sections: Section[] = [{
        columns: [
            col("name", "Customer", 118), col("kind", "Kind", 45, "left", true),
            col("mobile", "Mobile", 70), col("email", "Email", 110, "left", true),
            col("vehicles", "Cars", 32, "right"), col("invoiced", `Invoiced (${c})`, 76.28, "right"),
            col("lastInvoice", "Last invoice", 60),
        ],
        // The page shows what fits; the spreadsheet carries the rest.
        csvColumns: [
            col("name", "Customer", 0), col("kind", "Kind", 0),
            col("mobile", "Mobile", 0), col("phone", "Phone", 0), col("email", "Email", 0),
            col("streetAddress1", "Address", 0), col("streetSuburb", "Suburb", 0),
            col("streetCity", "City", 0), col("streetPostcode", "Postcode", 0),
            col("vatNumber", "Tax number", 0), col("terms", "Terms", 0),
            col("vehicles", "Cars", 0), col("invoiced", `Invoiced (${c})`, 0),
            col("lastInvoice", "Last invoice", 0), col("since", "On file since", 0),
            col("archived", "Archived", 0),
        ],
        rows: rows.map((r) => ({
            name: r.name, kind: r.kind, mobile: r.mobile ?? "", phone: r.phone ?? "", email: r.email ?? "",
            streetAddress1: r.streetAddress1 ?? "", streetSuburb: r.streetSuburb ?? "",
            streetCity: r.streetCity ?? "", streetPostcode: r.streetPostcode ?? "",
            vatNumber: r.vatNumber ?? "", terms: r.terms,
            vehicles: int(r.vehicles), invoiced: dec(r.invoiced), lastInvoice: r.lastInvoice,
            since: r.since, archived: r.archived,
        })),
        empty: "No customers on file.",
    }];

    const spent = rows.reduce((t, r) => t + r.invoiced, 0);

    return {
        title: BUSINESS_TITLES.customers,
        rows: countRows(sections),
        sections,
        totals: [
            { label: "Customers", value: int(rows.length) },
            { label: "Vehicles", value: int(rows.reduce((t, r) => t + r.vehicles, 0)) },
            { label: `Invoiced, ever (${c})`, value: dec(Math.round(spent * 100) / 100), strong: true },
        ],
        notes: [
            "Everyone on file, in alphabetical order, with what they have been invoiced since the workshop started keeping records here.",
            "The CSV carries the full postal address and account details as well; the PDF shows the columns that fit on a page.",
            includeArchived ? "Archived customers are included." : "Archived customers are left out.",
        ],
    };
}

export async function vehiclesRegister(db: TenantDb, tenant: Tenant, includeArchived: boolean): Promise<Register> {
    const rows = await vehicleListing(db, includeArchived);

    const sections: Section[] = [{
        columns: [
            col("plate", "Plate", 62), col("vehicle", "Vehicle", 130),
            col("customer", "Customer", 105), col("odometer", "Odometer", 50, "right"),
            col("lastIn", "Last in", 55, "left", true), col("nextService", "Next service", 55),
            col("licenceExpiry", "Disc expires", 54.28),
        ],
        csvColumns: [
            col("plate", "Plate", 0), col("make", "Make", 0), col("model", "Model", 0), col("year", "Year", 0),
            col("vin", "VIN", 0), col("engineNumber", "Engine number", 0), col("colour", "Colour", 0),
            col("fuel", "Fuel", 0), col("transmission", "Transmission", 0), col("fleetCode", "Fleet code", 0),
            col("customer", "Customer", 0), col("odometer", "Odometer", 0), col("jobs", "Jobs", 0),
            col("lastIn", "Last in", 0), col("lastService", "Last service", 0), col("nextService", "Next service", 0),
            col("licenceExpiry", "Disc expires", 0), col("roadworthyExpiry", "Roadworthy expires", 0),
            col("archived", "Archived", 0),
        ],
        rows: rows.map((r) => ({
            plate: r.plate,
            vehicle: [r.year, r.make, r.model].filter(Boolean).join(" "),
            make: r.make, model: r.model, year: r.year, vin: r.vin,
            engineNumber: r.engineNumber, colour: r.colour, fuel: r.fuel,
            transmission: r.transmission, fleetCode: r.fleetCode,
            customer: r.customer, odometer: r.odometer, jobs: int(r.jobs),
            lastIn: r.lastIn, lastService: r.lastService, nextService: r.nextService,
            licenceExpiry: r.licenceExpiry, roadworthyExpiry: r.roadworthyExpiry,
            archived: r.archived,
        })),
        empty: "No vehicles on file.",
    }];

    return {
        title: BUSINESS_TITLES.vehicles,
        rows: countRows(sections),
        sections,
        notes: [
            "Every vehicle on file, by plate, with the dates that decide when it should next come in.",
            "The owner's name is here; their telephone number is not. A list of cars can be handed to a parts supplier or a fleet customer without a second thought — the renewals report is the one that exists for ringing people.",
            "The CSV also carries the VIN, engine number, fuel, transmission and fleet code.",
            includeArchived ? "Archived vehicles are included." : "Archived vehicles are left out.",
        ],
    };
}
