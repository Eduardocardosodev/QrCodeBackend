-- AlterTable
ALTER TABLE "QrCode" ADD COLUMN "isInUse" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "QrCode_isInUse_idx" ON "QrCode"("isInUse");
