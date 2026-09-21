-- AlterTable
ALTER TABLE "Attachment" ADD COLUMN     "checksum" TEXT,
ADD COLUMN     "driver" TEXT NOT NULL DEFAULT 'local';

