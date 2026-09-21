-- CreateEnum
CREATE TYPE "UserGroup" AS ENUM ('OWNER', 'ADMIN', 'SERVICE_ADVISOR', 'MECHANIC', 'INVOICE_PAY', 'READ_ONLY');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "ContactMethod" AS ENUM ('EMAIL', 'SMS', 'WHATSAPP', 'OPT_OUT');

-- CreateEnum
CREATE TYPE "PriceType" AS ENUM ('RETAIL', 'PRICE2', 'PRICE3', 'PRICE4');

-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('STOCK', 'LABOUR', 'SUBLET', 'CONSUMABLE', 'ACCESSORY', 'TYRE');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('QUOTE', 'BOOKING', 'JOB_CARD', 'INVOICE', 'CASH_SALE', 'CREDIT');

-- CreateEnum
CREATE TYPE "DocumentState" AS ENUM ('DRAFT', 'PROCESSED', 'VOID');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('BOOKED_IN', 'WORK_IN_PROGRESS', 'WAITING_FOR_PARTS', 'INSPECTION_IN_PROGRESS', 'WAITING_FOR_CUSTOMER_APPROVAL', 'JOB_COMPLETE', 'CUSTOMER_NOTIFIED', 'AWAITING_FINALISE', 'FINALISED');

-- CreateEnum
CREATE TYPE "LineType" AS ENUM ('STOCK', 'LABOUR', 'SUBLET', 'CONSUMABLE', 'ACCESSORY', 'TYRE', 'FREIGHT');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'COMPLETED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CreditKind" AS ENUM ('DEPOSIT', 'CREDIT_NOTE');

-- CreateEnum
CREATE TYPE "TimeEntrySource" AS ENUM ('MANUAL', 'CLOCK');

-- CreateEnum
CREATE TYPE "TemplateKind" AS ENUM ('INVOICE_NOTE', 'JOB_CARD_NOTE', 'INVOICE_FOOTER', 'QUOTE_FOOTER', 'JOB_CARD_FOOTER', 'STATEMENT_FOOTER', 'EMAIL', 'SMS');

-- CreateEnum
CREATE TYPE "SequenceKey" AS ENUM ('QUOTE', 'JOB', 'INVOICE', 'CREDIT', 'RECEIPT', 'PURCHASE_ORDER', 'SUPPLIER_PAYMENT');

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "registrationNumber" TEXT,
    "vatNumber" TEXT,
    "address1" TEXT,
    "address2" TEXT,
    "suburb" TEXT,
    "city" TEXT,
    "region" TEXT,
    "postcode" TEXT,
    "country" TEXT NOT NULL DEFAULT 'NA',
    "phone" TEXT,
    "mobile" TEXT,
    "whatsapp" TEXT,
    "email" TEXT,
    "web" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Windhoek',
    "currency" TEXT NOT NULL DEFAULT 'NAD',
    "locale" TEXT NOT NULL DEFAULT 'en-NA',
    "taxName" TEXT NOT NULL DEFAULT 'VAT',
    "salesTaxRate" DECIMAL(5,2) NOT NULL DEFAULT 15.00,
    "purchaseTaxRate" DECIMAL(5,2) NOT NULL DEFAULT 15.00,
    "pricesIncludeTax" BOOLEAN NOT NULL DEFAULT true,
    "defaultPaymentTermsDays" INTEGER NOT NULL DEFAULT 0,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "mobile" TEXT,
    "isSuperuser" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "group" "UserGroup" NOT NULL DEFAULT 'SERVICE_ADVISOR',
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "isMechanic" BOOLEAN NOT NULL DEFAULT false,
    "isServiceAdvisor" BOOLEAN NOT NULL DEFAULT false,
    "dashboardPrivileges" BOOLEAN NOT NULL DEFAULT false,
    "limitCustomerInfo" BOOLEAN NOT NULL DEFAULT false,
    "showOnDiary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "group" "UserGroup" NOT NULL DEFAULT 'SERVICE_ADVISOR',
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "invitedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "isBusiness" BOOLEAN NOT NULL DEFAULT false,
    "billerId" TEXT,
    "businessNumber" TEXT,
    "vatNumber" TEXT,
    "streetAddress1" TEXT,
    "streetAddress2" TEXT,
    "streetSuburb" TEXT,
    "streetCity" TEXT,
    "streetRegion" TEXT,
    "streetCountry" TEXT,
    "streetPostcode" TEXT,
    "postalAddress1" TEXT,
    "postalAddress2" TEXT,
    "postalSuburb" TEXT,
    "postalCity" TEXT,
    "postalRegion" TEXT,
    "postalCountry" TEXT,
    "postalPostcode" TEXT,
    "phone" TEXT,
    "mobile" TEXT,
    "email" TEXT,
    "fax" TEXT,
    "web" TEXT,
    "preferredContact" "ContactMethod" NOT NULL DEFAULT 'WHATSAPP',
    "hourlyRate" DECIMAL(12,2),
    "discountPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "markupPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "priceType" "PriceType" NOT NULL DEFAULT 'RETAIL',
    "paymentTermsDays" INTEGER,
    "creditLimit" DECIMAL(12,2),
    "vatExempt" BOOLEAN NOT NULL DEFAULT false,
    "customerSourceId" TEXT,
    "importedId" TEXT,
    "note" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT,
    "supplierId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "position" TEXT,
    "phone" TEXT,
    "mobile" TEXT,
    "email" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT,
    "plate" TEXT NOT NULL,
    "vin" TEXT,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "modelSeries" TEXT,
    "year" INTEGER,
    "engineNumber" TEXT,
    "chassisNumber" TEXT,
    "engineCode" TEXT,
    "fleetCode" TEXT,
    "vehicleGroup" TEXT,
    "bodyType" TEXT,
    "transmission" TEXT,
    "driveType" TEXT,
    "fuelType" TEXT,
    "cylinders" INTEGER,
    "litres" DECIMAL(4,1),
    "hasAc" BOOLEAN NOT NULL DEFAULT false,
    "seating" INTEGER,
    "colour" TEXT,
    "tyreSize" TEXT,
    "keyCode" TEXT,
    "radioPin" TEXT,
    "buildDate" DATE,
    "odometer" INTEGER,
    "engineHours" DECIMAL(10,1),
    "licenceExpiry" DATE,
    "roadworthyExpiry" DATE,
    "lastInDate" DATE,
    "lastServiceDate" DATE,
    "nextServiceDate" DATE,
    "nextServiceKm" INTEGER,
    "serviceIntervalMonths" INTEGER,
    "importedId" TEXT,
    "note" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "accountNumber" TEXT,
    "vatNumber" TEXT,
    "address1" TEXT,
    "address2" TEXT,
    "suburb" TEXT,
    "city" TEXT,
    "region" TEXT,
    "country" TEXT,
    "postcode" TEXT,
    "phone" TEXT,
    "mobile" TEXT,
    "email" TEXT,
    "fax" TEXT,
    "web" TEXT,
    "paymentTermsDays" INTEGER,
    "importedId" TEXT,
    "note" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductGroup" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "salesAccount" TEXT,
    "purchaseAccount" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductCategory" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "itemCode" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "description2" TEXT,
    "tags" TEXT,
    "groupId" TEXT,
    "categoryId" TEXT,
    "supplierId" TEXT,
    "brand" TEXT,
    "type" "ProductType" NOT NULL DEFAULT 'STOCK',
    "isService" BOOLEAN NOT NULL DEFAULT false,
    "vatExempt" BOOLEAN NOT NULL DEFAULT false,
    "dontUpdateQty" BOOLEAN NOT NULL DEFAULT false,
    "requiresSerial" BOOLEAN NOT NULL DEFAULT false,
    "defaultLabourQty" DECIMAL(8,2),
    "qtyOnHand" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "qtyReserved" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "minQty" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "maxQty" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "location" TEXT,
    "costExTax" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "costIncTax" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "retailPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "price2" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "price3" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "price4" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "importedId" TEXT,
    "comment" TEXT,
    "jobCardComment" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerSource" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "CustomerSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentMethod" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "isEft" BOOLEAN NOT NULL DEFAULT false,
    "isIntegrated" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PaymentMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppointmentType" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "estimatedHours" DECIMAL(5,2) NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AppointmentType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sequence" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "key" "SequenceKey" NOT NULL,
    "prefix" TEXT NOT NULL DEFAULT '',
    "next" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Sequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Template" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kind" "TemplateKind" NOT NULL,
    "name" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "state" "DocumentState" NOT NULL DEFAULT 'DRAFT',
    "jobStatus" "JobStatus",
    "statusComment" TEXT,
    "number" TEXT,
    "jobNumber" TEXT,
    "customerId" TEXT,
    "isCashSale" BOOLEAN NOT NULL DEFAULT false,
    "vehicleId" TEXT,
    "serviceAdvisorId" TEXT,
    "mechanicId" TEXT,
    "reference" TEXT,
    "customerOrderNumber" TEXT,
    "postDate" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" DATE,
    "followUpDate" DATE,
    "scheduledAt" TIMESTAMP(3),
    "scheduledEnd" TIMESTAMP(3),
    "dueBy" TIMESTAMP(3),
    "estimatedHours" DECIMAL(5,2),
    "odometer" INTEGER,
    "engineHours" DECIMAL(10,1),
    "nextServiceKm" INTEGER,
    "nextServiceDate" DATE,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "paymentTermsDays" INTEGER,
    "customerSourceId" TEXT,
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discountPercent" DECIMAL(5,2),
    "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "freight" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "vatTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "amountPaid" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "eventNotes" TEXT,
    "jobCardNotes" TEXT,
    "invoiceNotes" TEXT,
    "contactedAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "processedById" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "sourceDocumentId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentLine" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "productId" TEXT,
    "lineType" "LineType" NOT NULL DEFAULT 'STOCK',
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "unitCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "vatRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "discountPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "lineSubtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "vatAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "lineTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "serialNumbers" TEXT,
    "isCustomerSupplied" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentStatusEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "fromStatus" "JobStatus",
    "toStatus" "JobStatus" NOT NULL,
    "comment" TEXT,
    "byId" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentStatusEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeEntry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "mechanicId" TEXT NOT NULL,
    "source" "TimeEntrySource" NOT NULL DEFAULT 'MANUAL',
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "minutes" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "methodId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reference" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'COMPLETED',
    "receiptNumber" TEXT,
    "proofAttachmentId" TEXT,
    "note" TEXT,
    "takenById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentAllocation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "PaymentAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Credit" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "kind" "CreditKind" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "remaining" DECIMAL(12,2) NOT NULL,
    "sourceDocumentId" TEXT,
    "paymentId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Credit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ownerType" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "diff" JSONB,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Membership_tenantId_status_idx" ON "Membership"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_userId_tenantId_key" ON "Membership"("userId", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_token_key" ON "Invitation"("token");

-- CreateIndex
CREATE INDEX "Invitation_tenantId_email_idx" ON "Invitation"("tenantId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Customer_tenantId_lastName_firstName_idx" ON "Customer"("tenantId", "lastName", "firstName");

-- CreateIndex
CREATE INDEX "Customer_tenantId_mobile_idx" ON "Customer"("tenantId", "mobile");

-- CreateIndex
CREATE INDEX "Customer_tenantId_archivedAt_idx" ON "Customer"("tenantId", "archivedAt");

-- CreateIndex
CREATE INDEX "Contact_customerId_idx" ON "Contact"("customerId");

-- CreateIndex
CREATE INDEX "Contact_supplierId_idx" ON "Contact"("supplierId");

-- CreateIndex
CREATE INDEX "Vehicle_tenantId_plate_idx" ON "Vehicle"("tenantId", "plate");

-- CreateIndex
CREATE INDEX "Vehicle_tenantId_vin_idx" ON "Vehicle"("tenantId", "vin");

-- CreateIndex
CREATE INDEX "Vehicle_tenantId_customerId_idx" ON "Vehicle"("tenantId", "customerId");

-- CreateIndex
CREATE INDEX "Supplier_tenantId_companyName_idx" ON "Supplier"("tenantId", "companyName");

-- CreateIndex
CREATE UNIQUE INDEX "ProductGroup_tenantId_name_key" ON "ProductGroup"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ProductCategory_tenantId_name_key" ON "ProductCategory"("tenantId", "name");

-- CreateIndex
CREATE INDEX "Product_tenantId_description_idx" ON "Product"("tenantId", "description");

-- CreateIndex
CREATE UNIQUE INDEX "Product_tenantId_itemCode_key" ON "Product"("tenantId", "itemCode");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerSource_tenantId_name_key" ON "CustomerSource"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentMethod_tenantId_code_key" ON "PaymentMethod"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "AppointmentType_tenantId_description_key" ON "AppointmentType"("tenantId", "description");

-- CreateIndex
CREATE UNIQUE INDEX "Sequence_tenantId_key_key" ON "Sequence"("tenantId", "key");

-- CreateIndex
CREATE INDEX "Template_tenantId_kind_idx" ON "Template"("tenantId", "kind");

-- CreateIndex
CREATE INDEX "Document_tenantId_type_state_idx" ON "Document"("tenantId", "type", "state");

-- CreateIndex
CREATE INDEX "Document_tenantId_number_idx" ON "Document"("tenantId", "number");

-- CreateIndex
CREATE INDEX "Document_tenantId_customerId_idx" ON "Document"("tenantId", "customerId");

-- CreateIndex
CREATE INDEX "Document_tenantId_vehicleId_idx" ON "Document"("tenantId", "vehicleId");

-- CreateIndex
CREATE INDEX "Document_tenantId_scheduledAt_idx" ON "Document"("tenantId", "scheduledAt");

-- CreateIndex
CREATE INDEX "Document_tenantId_jobStatus_idx" ON "Document"("tenantId", "jobStatus");

-- CreateIndex
CREATE INDEX "DocumentLine_documentId_sortOrder_idx" ON "DocumentLine"("documentId", "sortOrder");

-- CreateIndex
CREATE INDEX "DocumentLine_tenantId_productId_idx" ON "DocumentLine"("tenantId", "productId");

-- CreateIndex
CREATE INDEX "DocumentStatusEvent_documentId_at_idx" ON "DocumentStatusEvent"("documentId", "at");

-- CreateIndex
CREATE INDEX "TimeEntry_tenantId_mechanicId_startedAt_idx" ON "TimeEntry"("tenantId", "mechanicId", "startedAt");

-- CreateIndex
CREATE INDEX "TimeEntry_documentId_idx" ON "TimeEntry"("documentId");

-- CreateIndex
CREATE INDEX "Payment_tenantId_customerId_receivedAt_idx" ON "Payment"("tenantId", "customerId", "receivedAt");

-- CreateIndex
CREATE INDEX "Payment_tenantId_status_idx" ON "Payment"("tenantId", "status");

-- CreateIndex
CREATE INDEX "PaymentAllocation_documentId_idx" ON "PaymentAllocation"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAllocation_paymentId_documentId_key" ON "PaymentAllocation"("paymentId", "documentId");

-- CreateIndex
CREATE INDEX "Credit_tenantId_customerId_idx" ON "Credit"("tenantId", "customerId");

-- CreateIndex
CREATE INDEX "Attachment_tenantId_ownerType_ownerId_idx" ON "Attachment"("tenantId", "ownerType", "ownerId");

-- CreateIndex
CREATE INDEX "AuditEvent_tenantId_entityType_entityId_idx" ON "AuditEvent"("tenantId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditEvent_tenantId_at_idx" ON "AuditEvent"("tenantId", "at");

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_billerId_fkey" FOREIGN KEY ("billerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_customerSourceId_fkey" FOREIGN KEY ("customerSourceId") REFERENCES "CustomerSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductGroup" ADD CONSTRAINT "ProductGroup_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCategory" ADD CONSTRAINT "ProductCategory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ProductGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProductCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerSource" ADD CONSTRAINT "CustomerSource_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentMethod" ADD CONSTRAINT "PaymentMethod_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentType" ADD CONSTRAINT "AppointmentType_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sequence" ADD CONSTRAINT "Sequence_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Template" ADD CONSTRAINT "Template_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_serviceAdvisorId_fkey" FOREIGN KEY ("serviceAdvisorId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_mechanicId_fkey" FOREIGN KEY ("mechanicId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_processedById_fkey" FOREIGN KEY ("processedById") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_customerSourceId_fkey" FOREIGN KEY ("customerSourceId") REFERENCES "CustomerSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentLine" ADD CONSTRAINT "DocumentLine_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentLine" ADD CONSTRAINT "DocumentLine_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentLine" ADD CONSTRAINT "DocumentLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentStatusEvent" ADD CONSTRAINT "DocumentStatusEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentStatusEvent" ADD CONSTRAINT "DocumentStatusEvent_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentStatusEvent" ADD CONSTRAINT "DocumentStatusEvent_byId_fkey" FOREIGN KEY ("byId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_mechanicId_fkey" FOREIGN KEY ("mechanicId") REFERENCES "Membership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_methodId_fkey" FOREIGN KEY ("methodId") REFERENCES "PaymentMethod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_takenById_fkey" FOREIGN KEY ("takenById") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Credit" ADD CONSTRAINT "Credit_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Credit" ADD CONSTRAINT "Credit_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Credit" ADD CONSTRAINT "Credit_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Credit" ADD CONSTRAINT "Credit_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
