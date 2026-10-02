import "server-only";

import { LEGAL_ENTITY } from "@/lib/legal/documents";

/**
 * Where a new client pays, read from configuration.
 *
 * Not constants, for two reasons that pull the same way. An account number
 * shown to customers is the highest-value string in the deployment to somebody
 * hostile — change it and payments go elsewhere silently, and the first symptom
 * is a customer insisting they paid — so it stays out of the repository, where
 * a clone would be enough to read it. And the installed edition at a council
 * does not bill through Omzizi at all, so a constant would be wrong there by
 * construction.
 *
 * Missing configuration returns `null` rather than a partial set of details. A
 * confirmation page with the bank name and no account number is worse than one
 * that admits it cannot show them: the first sends somebody to look the number
 * up somewhere else, and "somewhere else" is how people pay the wrong account.
 */

export type BankDetails = {
    /** The account holder, as it must be typed into a beneficiary field. */
    accountName: string;
    bankName: string;
    branchCode: string;
    accountNumber: string;
    accountType: string | null;
};

function env(name: string): string | null {
    const value = process.env[name]?.trim();
    return value ? value : null;
}

export function bankDetails(): BankDetails | null {
    const bankName = env("BILLING_BANK_NAME");
    const branchCode = env("BILLING_BANK_BRANCH_CODE");
    const accountNumber = env("BILLING_BANK_ACCOUNT_NUMBER");

    // The three that cannot be guessed or defaulted. Without any one of them a
    // payment cannot be made correctly, so all or nothing.
    if (!bankName || !branchCode || !accountNumber) return null;

    return {
        // Falls back to the registered name rather than the brand: a bank
        // beneficiary field is matched against the account holder, and
        // "Motion Dynamic Systems" is not who holds the account.
        accountName: env("BILLING_ENTITY_NAME") ?? LEGAL_ENTITY.name,
        bankName,
        branchCode,
        accountNumber,
        accountType: env("BILLING_BANK_ACCOUNT_TYPE"),
    };
}

/**
 * Whether this deployment is able to take a registration at all.
 *
 * Read before the plan chooser is offered, so somebody is not walked through
 * choosing a tier and then shown a page that cannot tell them where to pay.
 */
export function canAcceptRegistrations(): boolean {
    return bankDetails() !== null;
}
