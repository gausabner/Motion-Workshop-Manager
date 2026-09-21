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
 *
 * Two rules here exist because breaking them was possible until a test tried:
 *
 *   1. A `tenant` relation in a create is refused outright. Stepping aside
 *      when one appeared meant `tenant: { connect: { id: someoneElse } }`
 *      planted a record in another client's books.
 *   2. Anything this file does not explicitly know how to scope throws.
 *      `updateManyAndReturn` arrived in a later Prisma than the switch below
 *      and ran completely unscoped — it updated another client's row. Denying
 *      by default means the next operation Prisma adds fails loudly here
 *      instead of quietly crossing the wall.
 */
const TENANT_MODELS = new Set([
    "Membership", "Invitation", "Customer", "Contact", "Vehicle", "Supplier",
    "ProductGroup", "ProductCategory", "Product", "CustomerSource", "PaymentMethod",
    "AppointmentType", "Sequence", "Template", "Document", "DocumentLine",
    "DocumentStatusEvent", "TimeEntry", "Payment", "PaymentAllocation", "Credit",
    "Attachment", "AuditEvent", "PaymentTender", "ExternalRef", "ShareLink", "Message", "WorkingHours", "TimeOff", "BookingRequest", "InspectionTemplate",
    "InspectionTemplateItem", "Inspection", "InspectionItem", "Reminder", "Campaign", "CampaignRecipient", "StockMovement", "PurchaseOrder", "PurchaseOrderLine", "SupplierInvoice", "SupplierInvoiceLine", "SupplierPayment", "SupplierPaymentAllocation", "StockTake", "StockTakeLine", "BundleItem", "PriceMatrix", "PriceMatrixBand", "SerialUnit", "LoanVehicle", "Loan", "ApiKey",
]);

type AnyArgs = Record<string, unknown>;

function scopeWhere(args: AnyArgs, tenantId: string) {
    const where = (args.where ?? {}) as AnyArgs;
    args.where = { ...where, tenantId };
}

/**
 * Force the tenant onto a create, and refuse any attempt to set it by
 * relation. `connect` would name a tenant of the caller's choosing, which is
 * the one thing this layer exists to prevent.
 */
function scopeCreateData(data: AnyArgs, tenantId: string, model: string, operation: string): AnyArgs {
    if ("tenant" in data) {
        throw new Error(
            `${model}.${operation}: set \`tenantId\` directly rather than a \`tenant\` relation — a relation could name another workshop.`,
        );
    }
    return { ...data, tenantId };
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
                        case "updateManyAndReturn":
                        case "delete":
                        case "deleteMany":
                            scopeWhere(a, tenantId);
                            break;
                        case "create": {
                            a.data = scopeCreateData((a.data ?? {}) as AnyArgs, tenantId, model, operation);
                            break;
                        }
                        case "createMany":
                        case "createManyAndReturn": {
                            const data = a.data;
                            a.data = Array.isArray(data)
                                ? data.map((d) => scopeCreateData(d as AnyArgs, tenantId, model, operation))
                                : scopeCreateData(data as AnyArgs, tenantId, model, operation);
                            break;
                        }
                        case "upsert": {
                            scopeWhere(a, tenantId);
                            a.create = scopeCreateData((a.create ?? {}) as AnyArgs, tenantId, model, operation);
                            break;
                        }

                        default:
                            // Deny by default: an operation nobody has taught this
                            // extension to scope must not reach the database.
                            throw new Error(
                                `${model}.${operation}: this operation is not tenant-scoped. Add it to forTenant() before using it.`,
                            );
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
