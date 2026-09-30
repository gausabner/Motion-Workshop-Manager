import { LegalPage } from "@/components/public/LegalPage";
import { TERMS, TERMS_UPDATED } from "@/lib/legal/documents";

export const metadata = {
    title: "Terms | MOTION Workshop Manager",
    description: "What you are agreeing to when you use MOTION, in ordinary sentences.",
};

export default function TermsPage() {
    return (
        <LegalPage
            title="Terms"
            intro="Written to be read. Where a clause exists to protect us rather than you, it says so rather than hiding in a paragraph about something else."
            updated={TERMS_UPDATED}
            clauses={TERMS}
        />
    );
}
