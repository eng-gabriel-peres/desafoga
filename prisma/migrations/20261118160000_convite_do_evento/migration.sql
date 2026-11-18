
-- AlterTable
ALTER TABLE "eventos" ADD COLUMN     "convite" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "eventos_convite_key" ON "eventos"("convite");

