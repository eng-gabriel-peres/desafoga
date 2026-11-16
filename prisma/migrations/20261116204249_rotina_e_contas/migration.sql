-- AlterTable
ALTER TABLE "pessoas" ADD COLUMN     "diaDaRenda" INTEGER,
ADD COLUMN     "rendaMensal" INTEGER;

-- CreateTable
CREATE TABLE "rotinas" (
    "pessoaId" TEXT NOT NULL,
    "horarioManha" TEXT NOT NULL DEFAULT '08:00',
    "horarioTarde" TEXT NOT NULL DEFAULT '12:00',
    "horarioNoite" TEXT NOT NULL DEFAULT '20:00',
    "manhaLigado" BOOLEAN NOT NULL DEFAULT true,
    "tardeLigado" BOOLEAN NOT NULL DEFAULT true,
    "noiteLigado" BOOLEAN NOT NULL DEFAULT true,
    "avisarQuandoTriste" BOOLEAN NOT NULL DEFAULT true,
    "compartilharContas" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "rotinas_pkey" PRIMARY KEY ("pessoaId")
);

-- CreateTable
CREATE TABLE "checkins" (
    "id" TEXT NOT NULL,
    "pessoaId" TEXT NOT NULL,
    "dia" DATE NOT NULL,
    "periodo" TEXT NOT NULL,
    "humor" INTEGER NOT NULL,
    "quando" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "checkins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contas_fixas" (
    "id" TEXT NOT NULL,
    "pessoaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "categoria" TEXT NOT NULL DEFAULT 'outra',
    "valor" INTEGER NOT NULL,
    "vencimento" INTEGER NOT NULL,
    "variavel" BOOLEAN NOT NULL DEFAULT false,
    "debitoAutomatico" BOOLEAN NOT NULL DEFAULT false,
    "lembrete" BOOLEAN NOT NULL DEFAULT true,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contas_fixas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagamentos" (
    "id" TEXT NOT NULL,
    "pessoaId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "alvoId" TEXT NOT NULL,
    "mes" TEXT NOT NULL,
    "valor" INTEGER NOT NULL,
    "quando" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pagamentos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "checkins_pessoaId_dia_periodo_key" ON "checkins"("pessoaId", "dia", "periodo");

-- CreateIndex
CREATE INDEX "contas_fixas_pessoaId_idx" ON "contas_fixas"("pessoaId");

-- CreateIndex
CREATE INDEX "pagamentos_pessoaId_mes_idx" ON "pagamentos"("pessoaId", "mes");

-- CreateIndex
CREATE UNIQUE INDEX "pagamentos_tipo_alvoId_mes_key" ON "pagamentos"("tipo", "alvoId", "mes");

-- AddForeignKey
ALTER TABLE "rotinas" ADD CONSTRAINT "rotinas_pessoaId_fkey" FOREIGN KEY ("pessoaId") REFERENCES "pessoas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkins" ADD CONSTRAINT "checkins_pessoaId_fkey" FOREIGN KEY ("pessoaId") REFERENCES "pessoas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contas_fixas" ADD CONSTRAINT "contas_fixas_pessoaId_fkey" FOREIGN KEY ("pessoaId") REFERENCES "pessoas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamentos" ADD CONSTRAINT "pagamentos_pessoaId_fkey" FOREIGN KEY ("pessoaId") REFERENCES "pessoas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
