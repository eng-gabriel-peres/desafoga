
-- AlterTable
ALTER TABLE "compras" ADD COLUMN     "cartaoId" TEXT,
ADD COLUMN     "meio" TEXT;

-- CreateTable
CREATE TABLE "cartoes" (
    "id" TEXT NOT NULL,
    "pessoaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "fechamento" INTEGER NOT NULL,
    "vencimento" INTEGER NOT NULL,
    "limite" INTEGER,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cartoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saldos_informados" (
    "pessoaId" TEXT NOT NULL,
    "valor" INTEGER NOT NULL,
    "desde" TEXT NOT NULL,
    "quando" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saldos_informados_pkey" PRIMARY KEY ("pessoaId")
);

-- CreateTable
CREATE TABLE "lancamentos_na_conta" (
    "id" TEXT NOT NULL,
    "pessoaId" TEXT NOT NULL,
    "dia" TEXT NOT NULL,
    "valor" INTEGER NOT NULL,
    "descricao" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lancamentos_na_conta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cartoes_pessoaId_idx" ON "cartoes"("pessoaId");

-- CreateIndex
CREATE INDEX "lancamentos_na_conta_pessoaId_dia_idx" ON "lancamentos_na_conta"("pessoaId", "dia");

-- AddForeignKey
ALTER TABLE "cartoes" ADD CONSTRAINT "cartoes_pessoaId_fkey" FOREIGN KEY ("pessoaId") REFERENCES "pessoas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saldos_informados" ADD CONSTRAINT "saldos_informados_pessoaId_fkey" FOREIGN KEY ("pessoaId") REFERENCES "pessoas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamentos_na_conta" ADD CONSTRAINT "lancamentos_na_conta_pessoaId_fkey" FOREIGN KEY ("pessoaId") REFERENCES "pessoas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

