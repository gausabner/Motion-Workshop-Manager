-- Stock on hand now comes from the movement ledger, and a quantity with no
-- movement behind it cannot be explained or rebuilt. Anything already sitting
-- on a shelf gets the movement that put it there.
INSERT INTO "StockMovement" ("id", "tenantId", "productId", "at", "kind", "quantity", "unitCost", "note", "createdAt")
SELECT
    gen_random_uuid()::text,
    p."tenantId",
    p."id",
    p."createdAt",
    'OPENING',
    p."qtyOnHand",
    p."costExTax",
    'Stock on hand when the ledger started',
    now()
FROM "Product" p
WHERE p."qtyOnHand" <> 0
  AND NOT EXISTS (SELECT 1 FROM "StockMovement" m WHERE m."productId" = p."id");
