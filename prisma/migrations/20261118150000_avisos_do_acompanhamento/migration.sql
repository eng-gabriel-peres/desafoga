
-- AlterTable
ALTER TABLE "rotinas" ADD COLUMN     "avisarCompraAlta" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "avisarDiaDificil" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "horaDoLembrete" TEXT NOT NULL DEFAULT '21:00',
ADD COLUMN     "lembreteDiario" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "resumoDaSemana" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "valorDaCompraAlta" INTEGER NOT NULL DEFAULT 20000;

