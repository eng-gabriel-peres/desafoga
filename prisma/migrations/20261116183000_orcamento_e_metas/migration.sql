-- Contador de uso: já pode existir, criado por lib/limite.ts.
CREATE TABLE IF NOT EXISTS "uso" (
    "chave" TEXT NOT NULL,
    "dia" DATE NOT NULL,
    "total" INTEGER NOT NULL,

    CONSTRAINT "uso_pkey" PRIMARY KEY ("chave","dia")
);

-- CreateTable
CREATE TABLE "orcamentos" (
    "pessoaId" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "limite" INTEGER NOT NULL,

    CONSTRAINT "orcamentos_pkey" PRIMARY KEY ("pessoaId","categoria")
);

-- CreateTable
CREATE TABLE "metas" (
    "id" TEXT NOT NULL,
    "pessoaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "alvo" INTEGER NOT NULL,
    "prazo" DATE,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "metas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimentos_das_metas" (
    "id" TEXT NOT NULL,
    "metaId" TEXT NOT NULL,
    "valor" INTEGER NOT NULL,
    "descricao" TEXT NOT NULL DEFAULT '',
    "quando" TIMESTAMP(3) NOT NULL,
    "via" TEXT NOT NULL,

    CONSTRAINT "movimentos_das_metas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "metas_pessoaId_idx" ON "metas"("pessoaId");

-- CreateIndex
CREATE INDEX "movimentos_das_metas_metaId_quando_idx" ON "movimentos_das_metas"("metaId", "quando");

-- AddForeignKey
ALTER TABLE "orcamentos" ADD CONSTRAINT "orcamentos_pessoaId_fkey" FOREIGN KEY ("pessoaId") REFERENCES "pessoas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metas" ADD CONSTRAINT "metas_pessoaId_fkey" FOREIGN KEY ("pessoaId") REFERENCES "pessoas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentos_das_metas" ADD CONSTRAINT "movimentos_das_metas_metaId_fkey" FOREIGN KEY ("metaId") REFERENCES "metas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

