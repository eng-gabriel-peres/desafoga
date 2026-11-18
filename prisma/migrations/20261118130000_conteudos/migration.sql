
-- AlterTable
ALTER TABLE "profissionais" ADD COLUMN     "bio" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "conteudos" (
    "id" TEXT NOT NULL,
    "profissionalId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "tema" TEXT NOT NULL,
    "cor" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "texto" TEXT NOT NULL DEFAULT '',
    "corpo" TEXT[],
    "cartoes" TEXT[],
    "opcoes" TEXT[],
    "curtidasIniciais" INTEGER NOT NULL DEFAULT 0,
    "votosIniciais" INTEGER[],
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conteudos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reacoes_aos_conteudos" (
    "conteudoId" TEXT NOT NULL,
    "quem" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "opcao" INTEGER,

    CONSTRAINT "reacoes_aos_conteudos_pkey" PRIMARY KEY ("conteudoId","quem","tipo")
);

-- CreateTable
CREATE TABLE "comentarios_dos_conteudos" (
    "id" TEXT NOT NULL,
    "conteudoId" TEXT NOT NULL,
    "pessoaId" TEXT,
    "profissionalId" TEXT,
    "texto" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comentarios_dos_conteudos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seguir" (
    "pessoaId" TEXT NOT NULL,
    "profissionalId" TEXT NOT NULL,
    "desde" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seguir_pkey" PRIMARY KEY ("pessoaId","profissionalId")
);

-- CreateIndex
CREATE INDEX "conteudos_profissionalId_idx" ON "conteudos"("profissionalId");

-- CreateIndex
CREATE INDEX "conteudos_criadoEm_idx" ON "conteudos"("criadoEm");

-- CreateIndex
CREATE INDEX "comentarios_dos_conteudos_conteudoId_criadoEm_idx" ON "comentarios_dos_conteudos"("conteudoId", "criadoEm");

-- AddForeignKey
ALTER TABLE "conteudos" ADD CONSTRAINT "conteudos_profissionalId_fkey" FOREIGN KEY ("profissionalId") REFERENCES "profissionais"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reacoes_aos_conteudos" ADD CONSTRAINT "reacoes_aos_conteudos_conteudoId_fkey" FOREIGN KEY ("conteudoId") REFERENCES "conteudos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comentarios_dos_conteudos" ADD CONSTRAINT "comentarios_dos_conteudos_conteudoId_fkey" FOREIGN KEY ("conteudoId") REFERENCES "conteudos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comentarios_dos_conteudos" ADD CONSTRAINT "comentarios_dos_conteudos_pessoaId_fkey" FOREIGN KEY ("pessoaId") REFERENCES "pessoas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comentarios_dos_conteudos" ADD CONSTRAINT "comentarios_dos_conteudos_profissionalId_fkey" FOREIGN KEY ("profissionalId") REFERENCES "profissionais"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seguir" ADD CONSTRAINT "seguir_pessoaId_fkey" FOREIGN KEY ("pessoaId") REFERENCES "pessoas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seguir" ADD CONSTRAINT "seguir_profissionalId_fkey" FOREIGN KEY ("profissionalId") REFERENCES "profissionais"("id") ON DELETE CASCADE ON UPDATE CASCADE;

