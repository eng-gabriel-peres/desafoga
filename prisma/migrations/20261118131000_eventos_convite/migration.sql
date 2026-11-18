
-- AlterTable
ALTER TABLE "participantes_dos_eventos" ADD COLUMN     "aceito" BOOLEAN NOT NULL DEFAULT false;


-- Quem já estava nos eventos entrou pela regra anterior (sem convite).
UPDATE "participantes_dos_eventos" SET "aceito" = true;
