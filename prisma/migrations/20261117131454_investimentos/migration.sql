-- CreateTable
CREATE TABLE "investimentos_bancarios" (
    "id" TEXT NOT NULL,
    "pessoaId" TEXT NOT NULL,
    "conexaoId" TEXT NOT NULL,
    "pluggyId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "saldo" INTEGER NOT NULL,
    "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "investimentos_bancarios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "investimentos_bancarios_pluggyId_key" ON "investimentos_bancarios"("pluggyId");

-- CreateIndex
CREATE INDEX "investimentos_bancarios_pessoaId_idx" ON "investimentos_bancarios"("pessoaId");

-- AddForeignKey
ALTER TABLE "investimentos_bancarios" ADD CONSTRAINT "investimentos_bancarios_pessoaId_fkey" FOREIGN KEY ("pessoaId") REFERENCES "pessoas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investimentos_bancarios" ADD CONSTRAINT "investimentos_bancarios_conexaoId_fkey" FOREIGN KEY ("conexaoId") REFERENCES "conexoes_bancarias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

