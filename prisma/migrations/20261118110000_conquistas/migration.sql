-- CreateTable
CREATE TABLE "conquistas" (
    "id" TEXT NOT NULL,
    "pessoaId" TEXT NOT NULL,
    "autorId" TEXT,
    "icone" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "alvo" INTEGER NOT NULL,
    "premio" TEXT NOT NULL DEFAULT '',
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "concluidaEm" TIMESTAMP(3),

    CONSTRAINT "conquistas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "conquistas_pessoaId_idx" ON "conquistas"("pessoaId");

-- AddForeignKey
ALTER TABLE "conquistas" ADD CONSTRAINT "conquistas_pessoaId_fkey" FOREIGN KEY ("pessoaId") REFERENCES "pessoas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conquistas" ADD CONSTRAINT "conquistas_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "profissionais"("id") ON DELETE SET NULL ON UPDATE CASCADE;

