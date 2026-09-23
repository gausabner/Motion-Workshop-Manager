import { AsyncLocalStorage } from "node:async_hooks";
import type { ITXClientDenyList } from "@prisma/client/runtime/library";
import { Prisma, type PrismaPromise } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * Whether the current call is already inside a tenant transaction.
 *
 * A single query has to open its own transaction so the tenant setting and the
 * query itself land on the same pooled connection. Inside an interactive
 * transaction that would be wrong twice over — the setting is already applied,
 * and opening a second transaction would run the query on a different
 * connection, outside the one the caller believes they are in.
 */
const inTenantTransaction = new AsyncLocalStorage<true>();

/**
 * Models that carry a required `tenantId`. Every query against them is
 * rewritten to include the tenant, so a handler cannot forget to scope
 * (PRD USR-05). Row-level security in Postgres is the second layer: the
 * policies exist on all 54 tenant tables and are proven in `rls.dbtest.ts`,
 * but they are dormant until the app connects as `motion_app` instead of a
 * superuser — superusers bypass RLS unconditionally. Until then this
 * extension is still the only thing holding the wall up.
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

/**
 * The tenant-scoped client, before the transaction wrapper is layered on.
 * Named separately so the type it produces can be referred to — it is exactly
 * what a `$transaction` callback receives, and `TenantTx` is derived from it
 * rather than from the outer client, which would be a different shape.
 */
function scopedFor(tenantId: string) {
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
                    const scoped = query(a as any);
                    if (inTenantTransaction.getStore()) return scoped;

                    // Outside a transaction, the tenant has to be set on the same
                    // connection as the query, in the same transaction, or the
                    // pool hands the query a connection that never heard of it
                    // and row-level security returns nothing.
                    const [, result] = await prisma.$transaction([
                        prisma.$executeRaw`SELECT set_config('motion.tenant_id', ${tenantId}, true)`,
                        scoped as PrismaPromise<unknown>,
                    ]);
                    return result;
                },
            },
        },
    });

}

/** What a `$transaction` callback receives: the scoped client, minus the methods a transaction cannot offer. */
export type TenantTx = Omit<ReturnType<typeof scopedFor>, ITXClientDenyList>;

/**
 * The client `forTenant` hands back: the scoped client with a narrower
 * `$transaction`.
 *
 * Declared as an intersection with the scoped client rather than inferred from
 * the extended one, so that passing a `TenantDb` where a `TenantTx` is expected
 * — which most query helpers do, being called with both — is a trivial check
 * rather than a structural comparison of two enormous generated Prisma types.
 * Inferring it made the compiler give up with "excessive stack depth" at a
 * dozen call sites that were perfectly correct.
 */
export type TenantDb = ReturnType<typeof scopedFor> & {
    $transaction<R>(
        fn: (tx: TenantTx) => Promise<R>,
        options?: { maxWait?: number; timeout?: number; isolationLevel?: Prisma.TransactionIsolationLevel },
    ): Promise<R>;
};

export function forTenant(tenantId: string): TenantDb {
    if (!tenantId) throw new Error("forTenant: tenantId is required");
    const scopedClient = scopedFor(tenantId);

    /**
     * The same client, with the tenant announced at the start of every
     * interactive transaction.
     *
     * Layered on top of the scoped client rather than on `prisma`, and
     * delegating to *its* `$transaction`, which is the part that matters: the
     * transaction client Prisma passes to the callback is then still the scoped
     * one, so `forTenant`'s rewriting applies inside the transaction exactly as
     * it does outside. Delegating to the base client instead would hand back an
     * unscoped client and quietly remove the application-level wall from all 77
     * places that open a transaction — while switching the database-level one
     * on. That failure would be silent, which is the worst shape it could take.
     */
    /**
     * The same client, with the tenant announced at the start of every
     * interactive transaction.
     *
     * Layered on top of the scoped client and delegating to *its*
     * `$transaction`, which is the part that matters: the transaction client
     * Prisma passes to the callback is then still the scoped one, so
     * `forTenant`'s rewriting applies inside a transaction exactly as it does
     * outside. Delegating to the base client instead would hand back an
     * unscoped client and quietly remove the application-level wall from all
     * eighty-one places that open a transaction — while switching the
     * database-level one on. That failure would be silent, which is the worst
     * shape it could take.
     *
     * Typed explicitly rather than spread from Prisma's own signature, because
     * an untyped override turns every `tx` in the codebase into `any` and every
     * result into `unknown`. Only the callback form is typed here; nothing uses
     * the array form, and leaving it untyped would be the same trap in a
     * quieter corner.
     */
    return scopedClient.$extends({
        name: `tenant-tx:${tenantId}`,
        client: {
            $transaction<R>(
                fn: (tx: TenantTx) => Promise<R>,
                options?: { maxWait?: number; timeout?: number; isolationLevel?: Prisma.TransactionIsolationLevel },
            ): Promise<R> {
                return scopedClient.$transaction(async (tx) => {
                    await tx.$executeRaw`SELECT set_config('motion.tenant_id', ${tenantId}, true)`;
                    return inTenantTransaction.run(true, () => fn(tx as TenantTx));
                }, options);
            },
        },
    }) as unknown as TenantDb;
}


/**
 * Announce the tenant on a connection that is not going through `forTenant`.
 *
 * There are three places that legitimately write tenant-owned rows without a
 * session to scope them: registering a workshop, accepting an invitation, and
 * recording that a customer opened a share link. All three know which tenant
 * they mean; none of them can use `forTenant`, because in the first two the
 * membership that would establish it is the row being created.
 *
 * Without this, those three paths are the ones that break the day row-level
 * security is switched on — and they break at registration, which is the worst
 * possible place to find out.
 */
export async function announceTenant(
    tx: { $executeRaw: (q: TemplateStringsArray, ...values: unknown[]) => Promise<number> },
    tenantId: string,
): Promise<void> {
    await tx.$executeRaw`SELECT set_config('motion.tenant_id', ${tenantId}, true)`;
}
