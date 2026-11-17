-- AlterTable
ALTER TABLE "dividas" ADD COLUMN     "conferidos" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Antes do índice único: se a mesma pessoa tiver duas dívidas com a mesma chave
-- (duplo clique antes da trava), só a mais antiga fica com a chave.
UPDATE "dividas" SET "chave" = NULL
WHERE "chave" IS NOT NULL
  AND "id" NOT IN (
    SELECT DISTINCT ON ("pessoaId", "chave") "id" FROM "dividas"
    WHERE "chave" IS NOT NULL
    ORDER BY "pessoaId", "chave", "ctid"
  );

-- CreateIndex
CREATE UNIQUE INDEX "dividas_pessoaId_chave_key" ON "dividas"("pessoaId", "chave");
