-- CreateEnum
CREATE TYPE "LoanState" AS ENUM ('BOOKED', 'OUT', 'RETURNED', 'CANCELLED');

-- CreateTable
CREATE TABLE "LoanVehicle" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "plate" TEXT NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER,
    "colour" TEXT,
    "odometer" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "licenceExpiry" DATE,
    "insuranceExpiry" DATE,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoanVehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Loan" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "loanVehicleId" TEXT NOT NULL,
    "customerId" TEXT,
    "documentId" TEXT,
    "state" "LoanState" NOT NULL DEFAULT 'BOOKED',
    "outAt" TIMESTAMP(3) NOT NULL,
    "dueBackAt" TIMESTAMP(3) NOT NULL,
    "inAt" TIMESTAMP(3),
    "odometerOut" INTEGER,
    "odometerIn" INTEGER,
    "agreedBy" TEXT,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Loan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LoanVehicle_tenantId_active_idx" ON "LoanVehicle"("tenantId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "LoanVehicle_tenantId_plate_key" ON "LoanVehicle"("tenantId", "plate");

-- CreateIndex
CREATE INDEX "Loan_tenantId_state_outAt_idx" ON "Loan"("tenantId", "state", "outAt");

-- CreateIndex
CREATE INDEX "Loan_loanVehicleId_outAt_idx" ON "Loan"("loanVehicleId", "outAt");

-- AddForeignKey
ALTER TABLE "LoanVehicle" ADD CONSTRAINT "LoanVehicle_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_loanVehicleId_fkey" FOREIGN KEY ("loanVehicleId") REFERENCES "LoanVehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

