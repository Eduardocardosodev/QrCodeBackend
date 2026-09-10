-- AlterTable
ALTER TABLE "ScanEvent" ADD COLUMN "country" TEXT,
ADD COLUMN "state" TEXT,
ADD COLUMN "city" TEXT;

-- CreateIndex
CREATE INDEX "ScanEvent_country_idx" ON "ScanEvent"("country");

-- CreateIndex
CREATE INDEX "ScanEvent_state_idx" ON "ScanEvent"("state");

-- CreateIndex
CREATE INDEX "ScanEvent_city_idx" ON "ScanEvent"("city");
