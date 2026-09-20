import type { ITXClientDenyList } from "@prisma/client/runtime/library";
import { prisma } from "@/lib/db";

/**
 * Models that carry a required `tenantId`. Every query against them is
 * rewritten to include the tenant, so a handler cannot forget to scope
 * (PRD USR-05). Row-level security in Postgres is the second layer, added
 * once the app connects as a non-superuser role.
 *
 * Convention for writes: use scalar foreign keys (`customerId: "..."`), not
 * `connect`, so the injected `tenantId` scalar is accepted. For nested
 * creates set `tenantId` on the children yourself. Prisma's create types still
 * require `tenantId`, so pass it explicitly; the extension overwrites it with
 * the session's tenant regardless of what was passed.
 */
const TENANT_MODELS = new Set([
    "Membership", "Invitation", "Customer", "Contact", "Vehicle", "Supplier",
    "ProductGroup", "ProductCategory", "Product", "CustomerSource", "PaymentMethod",
    "AppointmentType", "Sequence", "Template", "Document", "DocumentLine",
    "DocumentStatusEvent", "TimeEntry", "Payment", "PaymentAllocation", "Credit",
    "Attachment", "AuditEvent", "PaymentTender", "ExternalRef", "ShareLink", "Message", "WorkingHours", "TimeOff", "BookingRequest", "InspectionTemplate",
    "InspectionTemplateItem", "Inspection", "InspectionItem", "Reminder", "Campaign", "CampaignRecipient", "StockMovement", "PurchaseOrder", "PurchaseOrderLine", "SupplierInvoice", "SupplierInvoiceLine", "SupplierPayment", "SupplierPaymentAllocation",
]);

type AnyArgs = Record<string, unknown>;

function scopeWhere(args: AnyArgs, tenantId: string) {
    const where = (args.where ?? {}) as AnyArgs;
    args.where = { ...where, tenantId };
}

export function forTenant(tenantId: string) {
    if (!tenantId) throw new Error("forTenant: tenantId is required");
    return prisma.$extends({
        name: `tenant:${tenantId}`,
        query: {
            $allModels: {
                async $allOperations({ model, operation, args, query }) {
                    if (!model || !TENANT_MODELS.has(model)) return query(args);
                    const a = (args ?? {}) as AnyArgs;
                    switch (operation) {
                        case "findUnique":
                        case "findUniqueOrThrow":
                        case "findFirst":
                        case "findFirstOrThrow":
                        case "findMany":
                        case "count":
                        case "aggregate":
                        case "groupBy":
                        case "update":
                        case "updateMany":
                        case "delete":
                        case "deleteMany":
                            scopeWhere(a, tenantId);
                            break;
                        case "create": {
                            const data = (a.data ?? {}) as AnyArgs;
                            if (!("tenant" in data)) a.data = { ...data, tenantId };
                            break;
                        }
                        case "createMany":
                        case "createManyAndReturn": {
                            const data = a.data;
                            a.data = Array.isArray(data)
                                ? data.map((d) => ({ ...(d as AnyArgs), tenantId }))
                                : { ...(data as AnyArgs), tenantId };
                            break;
                        }
                        case "upsert": {
                            scopeWhere(a, tenantId);
                            const create = (a.create ?? {}) as AnyArgs;
                            if (!("tenant" in create)) a.create = { ...create, tenantId };
                            break;
                        }
                    }
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    return query(a as any);
                },
            },
        },
    });
}

export type TenantDb = ReturnType<typeof forTenant>;

/** The client handed to a `db.$transaction(async (tx) => …)` callback: still tenant-scoped. */
export type TenantTx = Omit<TenantDb, ITXClientDenyList>;
