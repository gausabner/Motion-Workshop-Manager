/**
 * The terms and the privacy policy, as content rather than as pages.
 *
 * Two reasons. They are needed in more than one place — on the site, in a
 * proposal, and attached to an order form — and a version that differs between
 * those is the one a dispute turns on. And the legal name belongs in one place
 * rather than hunted through prose — which is what made filling it in a single
 * edit once the entity was identified.
 *
 * **These are drafts.** They are written to be read and argued with, not to be
 * relied on: the workshop owns the last word on both, and neither has been
 * seen by anybody admitted to practise in Namibia. Every clause that needs a
 * real decision is marked rather than guessed.
 */

/**
 * Who "we" is, legally.
 *
 * The contracting party is the close corporation, not the brand. A customer
 * disputing an invoice, or a council's procurement checking a supplier, needs
 * the registered name and number — "Motion Dynamic Systems" appears on no
 * register and could not be sued or paid.
 */
export const LEGAL_ENTITY = {
    /** The registered name. What goes on an invoice and in a contract. */
    name: "Omzizi Investment CC",
    /** The brand this product is sold under. The same business, a different name. */
    tradingAs: "Motion Dynamic Systems",
    registered: true,
    registrationNumber: "CC/2014/11996",
    /** Registered for VAT, so 15 % is charged and an invoice is a tax invoice. */
    vatNumber: "06658872-015",
    jurisdiction: "Namibia",
    /** Where a notice is served. The Windhoek office, being the trading address. */
    address: "Office II – 435 Ellis Street, Windhoek North, Windhoek, Namibia" as string | null,
    postalAddress: "P.O. Box 630, Oshakati West, Oshakati, Namibia",
    /** The second office. Named because a council asks where a supplier actually is. */
    otherAddress: "Office I – 464 Oshakati West, Oshakati, Namibia",
};

export type Clause = { heading: string; paragraphs: string[]; decide?: string };

export const TERMS_UPDATED = "2026-09-30";
export const PRIVACY_UPDATED = "2026-09-30";

export const TERMS: Clause[] = [
    {
        heading: "What you are agreeing to",
        paragraphs: [
            "These terms cover your use of MOTION Workshop Manager, whether we host it for you or it runs on your own server. Where we have signed a separate written agreement with you, that agreement wins wherever the two disagree.",
            "Where these terms say “we”, they mean the supplier of MOTION. Where they say “you”, they mean the business named on the subscription, not the individual member of staff signing in.",
        ],
    },
    {
        heading: "Your data belongs to you",
        paragraphs: [
            "Everything you put into MOTION — your customers, vehicles, documents, payments and parts — stays yours. We do not sell it, we do not use it to train anything, and we do not share it with anybody except where you ask us to or where the law requires it of us.",
            "You can take a complete copy out at any time, without asking and without notice: every table as a spreadsheet, in one archive, with a file explaining how they join. That is a feature of the product rather than a promise in a document, which is deliberate.",
            "If you stop paying, you do not lose it. See “If a payment fails” below.",
        ],
    },
    {
        heading: "What we will do",
        paragraphs: [
            "Keep the hosted service running, and fix it when it breaks. Tell you before we change something that would alter how you work, rather than after.",
            "Answer support as set out on the support page. Respond faster when the workshop is stopped than when the question is how something works.",
            "Back up your data every night to storage away from the machine that runs MOTION, encrypted so that neither we nor the storage provider can read it, and restore one of those backups every week to prove it still works. A night is the granularity: if the worst happens you could lose up to a day of entries, and you would re-enter them from the paper the floor already works from.",
        ],
        decide: "An uptime figure with a credit attached to it. That one still waits on a host being chosen, because a figure nobody is measuring is worse than no figure. The backup paragraph above is now safe to make — ops/backup/ does it, the security whitepaper describes it in section 8, and it is tested in CI and restored weekly — but check the wording says only what you want to be held to.",
    },
    {
        heading: "What you will do",
        paragraphs: [
            "Keep your own logins to yourself, and tell us if one is compromised. Make sure the people you give access to are entitled to see what that access shows them — the permissions are yours to set.",
            "Use MOTION for running a workshop. Not for anything unlawful, and not to store what you have no right to store.",
            "Pay on time, or tell us when you cannot. The second one is almost always fine.",
        ],
    },
    {
        heading: "Paying",
        paragraphs: [
            "Subscriptions are monthly, in Namibian dollars, per workshop rather than per user. Prices are published and can change, but not with less than 30 days' notice and not in the middle of a month you have already paid for.",
            "Prices are quoted excluding VAT. Omzizi Investment CC, trading as Motion Dynamic Systems, is registered for VAT under number 06658872-015, so 15 % is added and what we send you is a tax invoice you can claim against. N$1,200 a month is N$1,380 paid.",
            "Payment is by bank deposit or transfer to Omzizi Investment CC, using the reference we give you when you register. Quote that reference or we cannot match your payment, and an unmatched payment is an account nobody activates. Card payment is not available yet.",
            "Onboarding, data migration and training are quoted separately and are not part of the subscription.",
        ],
    },
    {
        heading: "If a payment fails",
        paragraphs: [
            "You get a grace period. After it, MOTION becomes read-only: you can still see everything, still print, still export, still get your books out. You cannot raise new documents until the account is settled.",
            "We do not lock a workshop out of its own floor over a declined card. Cash flow here is seasonal and a workshop that cannot invoice cannot pay us either.",
            "We do not delete your data for non-payment. If you leave, take the archive with you first — and ask us if you need help getting it.",
        ],
    },
    {
        heading: "Stopping",
        paragraphs: [
            "Month to month. Tell us and it ends at the end of the month you have paid for. There is no notice period and no exit fee.",
            "Export your data before you go. We will keep it for a period after you stop in case you come back, and then remove it — see the privacy policy for how long.",
        ],
    },
    {
        heading: "When it goes wrong",
        paragraphs: [
            "We will fix what is ours to fix. What we cannot sensibly accept is liability for what follows from a fault — the job that was not invoiced, the customer who went elsewhere — because that is unbounded and no subscription at this price can carry it.",
            "Nothing here limits liability for anything the law does not allow us to limit.",
        ],
        decide: "The liability cap. A common shape is the last twelve months of fees paid. This needs a lawyer before it is relied on.",
    },
    {
        heading: "Installed on your own server",
        paragraphs: [
            "Where MOTION runs on your hardware, you are responsible for the server, its backups and its network; we are responsible for the software and for the updates we supply.",
            "MOTION sends outbound only — a licence heartbeat, and whatever exports you configure. Nothing listens for an inbound connection, and nothing opens a door into your network.",
        ],
    },
    {
        heading: "Changes to these terms",
        paragraphs: [
            "We will tell you in advance and say what changed. Continuing to use MOTION after that is acceptance. If a change does not suit you, stopping is always available and never penalised.",
        ],
    },
];

export const PRIVACY: Clause[] = [
    {
        heading: "What this covers",
        paragraphs: [
            "How MOTION handles personal information: your staff's, and your customers'. Your customers gave their details to you, not to us — we hold them on your behalf and act on your instructions.",
        ],
    },
    {
        heading: "What we hold",
        paragraphs: [
            "For your staff: name, email address, the workshop they belong to and what they are allowed to do. A password is never stored — only a value derived from it that cannot be turned back.",
            "For your customers: whatever you enter. Typically a name, a telephone number, an email address, an address, and the vehicles and jobs attached to them.",
            "We also keep a record of who did what inside MOTION — who raised a document, who voided one, who exported data — because a workshop's books have to be provable.",
        ],
    },
    {
        heading: "What we do not do",
        paragraphs: [
            "We do not sell personal information. We do not use it to train models. We do not use your customers' details to market anything to them, and we do not mix one workshop's data with another's — separation is enforced in the database itself, not by application code remembering to filter.",
        ],
    },
    {
        heading: "Where it lives",
        paragraphs: [
            "On the hosted service, on servers we operate. Where MOTION is installed on your own equipment, it lives on your equipment and we hold none of it except what you send us when you ask for support.",
        ],
        decide: "Name the hosting country and provider once staging is chosen. A council will ask, and “we will tell you later” loses tenders.",
    },
    {
        heading: "Who else sees it",
        paragraphs: [
            "Nobody, except the small number of suppliers we need to run the service — hosting, and file storage where you have configured it. They act on our instructions and may not use your data for anything else.",
            "We will disclose information where the law genuinely requires it. If that happens and we are allowed to tell you, we will.",
        ],
        decide: "A named subprocessor list, with the hosting provider on it. Enterprise procurement asks for this by name.",
    },
    {
        heading: "How long it is kept",
        paragraphs: [
            "For as long as you are a customer, and for a period afterwards so that a workshop coming back does not find its history gone.",
            "A workshop's books are usually kept far longer than a subscription — seven years is the working assumption for accounting records here. Deletion requests are honoured except where keeping something is a legal requirement, in which case we will say so.",
        ],
        decide: "Confirm the retention period with a council or an accountant before publishing a figure. Seven years is assumed, not verified.",
    },
    {
        heading: "Your rights, and your customers'",
        paragraphs: [
            "Ask us what we hold about you and we will tell you. Ask us to correct it and we will. Ask us to delete it and we will, within what the law allows.",
            "Where the request is about one of your customers, it comes to you first — they are your customer and the data is yours to correct. MOTION gives you the tools to do it without us.",
        ],
    },
    {
        heading: "Security",
        paragraphs: [
            "Passwords, session tokens, invitation links and API keys are stored as values that cannot be reversed. Each workshop's data is separated inside the database by rules the database enforces. Access to what people can see is set by role, and removing contact details for staff who should not see them happens on the server, before the page is built, rather than by hiding them in the markup.",
            "No system is beyond compromise. If one happens and it affects you, we will tell you promptly and plainly.",
        ],
    },
    {
        heading: "Reaching us about this",
        paragraphs: ["Use the support page. Say that it is a privacy question and it will be treated as one."],
    },
];
