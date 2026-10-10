import { LegalPage } from "@/components/public/LegalPage";
import { PRIVACY, PRIVACY_UPDATED } from "@/lib/legal/documents";
import { atRequestTime } from "@/lib/edition";

export const metadata = {
    title: "Privacy | MOTION Workshop Manager",
    description: "What MOTION holds, what it never does with it, and how to get it out.",
};

export default async function PrivacyPage() {
    await atRequestTime();
    return (
        <LegalPage
            title="Privacy"
            intro="Your customers gave their details to you, not to us. This says what we hold on your behalf, what we will never do with it, and how you get all of it back."
            updated={PRIVACY_UPDATED}
            clauses={PRIVACY}
        />
    );
}
