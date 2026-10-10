/**
 * The names of things, said once.
 *
 * A screen reached from the navigation, a report card, a dashboard tile and a
 * page heading must call it the same thing, or the reader stops to wonder
 * whether "Who owes us" and "Receivables" are two different lists. These are
 * the names that appear in more than one of those places; each is the term in
 * the glossary of `docs/content-plan.md`, and a rename happens here.
 *
 * Plain strings, not a translation layer: MOTION is English-only, and the
 * point is consistency, not localisation.
 */
export const TERM = {
    openJobCards: "Open job cards",
    transactions: "Transactions",
    purchasing: "Purchasing",
    debtors: "Debtors",
    creditors: "Creditors",
    managementReports: "Management reports",
    auditReports: "Audit reports",
    accountingExport: "Accounting export",
    accountingIntegration: "Accounting integration",
    rework: "Rework",
} as const;

/** A browser tab title. The page first, so a row of tabs can be told apart. */
export function tabTitle(...parts: (string | null | undefined)[]): string {
    return `${parts.filter(Boolean).join(" — ")} | MOTION Workshop Manager`;
}
