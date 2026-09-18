-- CreateEnum
CREATE TYPE "PaymentDirection" AS ENUM ('RECEIPT', 'REFUND');

-- AlterEnum
ALTER TYPE "SequenceKey" ADD VALUE 'REFUND';

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "direction" "PaymentDirection" NOT NULL DEFAULT 'RECEIPT';

-- AlterTable
ALTER TABLE "PaymentTender" ADD COLUMN     "tendered" DECIMAL(12,2);

