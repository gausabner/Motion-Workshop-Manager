import type { DocumentType, JobStatus, LineType } from "@prisma/client";

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
    QUOTE: "Quote",
    BOOKING: "Booking",
    JOB_CARD: "Job card",
    INVOICE: "Invoice",
    CASH_SALE: "Cash sale",
    CREDIT: "Credit note",
};

/** Which sequence a processed document of each type draws its number from. */
export const TYPE_SEQUENCE = {
    QUOTE: "QUOTE",
    BOOKING: "JOB",
    JOB_CARD: "JOB",
    INVOICE: "INVOICE",
    CASH_SALE: "INVOICE",
    CREDIT: "CREDIT",
} as const;

/** The nine job statuses, in workshop order (PRD DOC-03). */
export const JOB_STATUS_ORDER: JobStatus[] = [
    "BOOKED_IN",
    "WORK_IN_PROGRESS",
    "WAITING_FOR_PARTS",
    "INSPECTION_IN_PROGRESS",
    "WAITING_FOR_CUSTOMER_APPROVAL",
    "JOB_COMPLETE",
    "CUSTOMER_NOTIFIED",
    "AWAITING_FINALISE",
    "FINALISED",
];

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
    BOOKED_IN: "Booked in",
    WORK_IN_PROGRESS: "Work in progress",
    WAITING_FOR_PARTS: "Waiting for parts",
    INSPECTION_IN_PROGRESS: "Inspection in progress",
    WAITING_FOR_CUSTOMER_APPROVAL: "Waiting for customer approval",
    JOB_COMPLETE: "Job complete",
    CUSTOMER_NOTIFIED: "Customer notified",
    AWAITING_FINALISE: "Complete – awaiting finalise",
    FINALISED: "Finalised",
};

/** Statuses the job can sit in while blocked, rather than progress through. */
export const HOLD_STATUSES = new Set<JobStatus>(["WAITING_FOR_PARTS", "INSPECTION_IN_PROGRESS", "WAITING_FOR_CUSTOMER_APPROVAL"]);

/** Tailwind classes per status, used by the board and the status pill. */
export const JOB_STATUS_STYLES: Record<JobStatus, string> = {
    BOOKED_IN: "bg-slate-100 text-slate-700 border-slate-300",
    WORK_IN_PROGRESS: "bg-blue-50 text-blue-700 border-blue-300",
    WAITING_FOR_PARTS: "bg-orange-50 text-orange-700 border-orange-300",
    INSPECTION_IN_PROGRESS: "bg-violet-50 text-violet-700 border-violet-300",
    WAITING_FOR_CUSTOMER_APPROVAL: "bg-amber-50 text-amber-800 border-amber-300",
    JOB_COMPLETE: "bg-green-50 text-green-700 border-green-300",
    CUSTOMER_NOTIFIED: "bg-teal-50 text-teal-700 border-teal-300",
    AWAITING_FINALISE: "bg-cyan-50 text-cyan-700 border-cyan-300",
    FINALISED: "bg-slate-800 text-white border-slate-800",
};

export const LINE_TYPE_LABELS: Record<LineType, string> = {
    STOCK: "Part",
    LABOUR: "Labour",
    SUBLET: "Sublet",
    CONSUMABLE: "Consumable",
    ACCESSORY: "Accessory",
    TYRE: "Tyre",
    FREIGHT: "Freight",
};

/** Product type → the line type it becomes when picked onto a document. */
export const PRODUCT_TO_LINE_TYPE = {
    STOCK: "STOCK",
    LABOUR: "LABOUR",
    SUBLET: "SUBLET",
    CONSUMABLE: "CONSUMABLE",
    ACCESSORY: "ACCESSORY",
    TYRE: "TYRE",
} as const;

/** Columns of the jobs board (PRD TXN-03): the statuses an open job moves between. */
export const BOARD_COLUMNS: JobStatus[] = [
    "BOOKED_IN",
    "WORK_IN_PROGRESS",
    "WAITING_FOR_PARTS",
    "WAITING_FOR_CUSTOMER_APPROVAL",
    "JOB_COMPLETE",
];
