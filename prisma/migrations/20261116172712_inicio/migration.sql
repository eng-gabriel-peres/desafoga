-- CreateEnum
CREATE TYPE "TipoDeEspaco" AS ENUM ('DEMO', 'REAL');

-- CreateTable
CREATE TABLE "espacos" (
    "id" TEXT NOT NULL,
    "tipo" "TipoDeEspaco" NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "espacos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessoes" (
    "id" TEXT NOT NULL,
    "espacoId" TEXT NOT NULL,
    "pessoaId" TEXT,
    "profissionalId" TEXT,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiraEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pessoas" (
    "id" TEXT NOT NULL,
    "espacoId" TEXT NOT NULL,
    "slug" TEXT,
    "nome" TEXT NOT NULL,
    "apelido" TEXT NOT NULL,
    "idade" INTEGER,
    "cor" TEXT NOT NULL,
    "perfil" TEXT NOT NULL DEFAULT '',
    "telefone" TEXT,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pessoas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profissionais" (
    "id" TEXT NOT NULL,
    "espacoId" TEXT NOT NULL,
    "slug" TEXT,
    "nome" TEXT NOT NULL,
    "papel" TEXT NOT NULL,
    "cor" TEXT NOT NULL,
    "convite" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profissionais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acompanhamentos" (
    "pessoaId" TEXT NOT NULL,
    "profissionalId" TEXT NOT NULL,
    "consentidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "acompanhamentos_pkey" PRIMARY KEY ("pessoaId","profissionalId")
);

-- CreateTable
CREATE TABLE "compras" (
    "id" TEXT NOT NULL,
    "pessoaId" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "valor" INTEGER NOT NULL,
    "emocao" INTEGER NOT NULL,
    "necessidade" TEXT NOT NULL,
    "quando" TIMESTAMP(3) NOT NULL,
    "via" TEXT NOT NULL,
    "avaliacaoProfissional" TEXT,

    CONSTRAINT "compras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dividas" (
    "id" TEXT NOT NULL,
    "pessoaId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "detalhe" TEXT NOT NULL DEFAULT '',
    "saldo" INTEGER NOT NULL,
    "taxaMensal" DOUBLE PRECISION NOT NULL,
    "parcelaMinima" INTEGER NOT NULL,
    "vencimento" INTEGER NOT NULL,

    CONSTRAINT "dividas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planos" (
    "pessoaId" TEXT NOT NULL,
    "valorMensal" INTEGER NOT NULL DEFAULT 0,
    "estrategia" TEXT NOT NULL DEFAULT 'mais-cara',
    "valorSugerido" INTEGER,

    CONSTRAINT "planos_pkey" PRIMARY KEY ("pessoaId")
);

-- CreateTable
CREATE TABLE "faturas" (
    "id" TEXT NOT NULL,
    "pessoaId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "origem" TEXT NOT NULL,
    "mes" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "faturas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lancamentos" (
    "id" TEXT NOT NULL,
    "faturaId" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "valor" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "categoria" TEXT,
    "compraId" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "lancamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memorias" (
    "pessoaId" TEXT NOT NULL,
    "caracteristicas" TEXT[],
    "tom" TEXT NOT NULL DEFAULT 'acolhedor',
    "objetivo" TEXT NOT NULL DEFAULT '',
    "evitar" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "memorias_pkey" PRIMARY KEY ("pessoaId")
);

-- CreateTable
CREATE TABLE "anotacoes" (
    "id" TEXT NOT NULL,
    "pessoaId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "privada" BOOLEAN NOT NULL DEFAULT false,
    "quando" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "anotacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "avisos" (
    "id" TEXT NOT NULL,
    "pessoaId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "quando" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "avisos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mensagens" (
    "id" TEXT NOT NULL,
    "pessoaId" TEXT NOT NULL,
    "canal" TEXT NOT NULL,
    "de" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "quando" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respostasRapidas" JSONB,

    CONSTRAINT "mensagens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estados_conversa" (
    "pessoaId" TEXT NOT NULL,
    "canal" TEXT NOT NULL,
    "estado" JSONB NOT NULL,

    CONSTRAINT "estados_conversa_pkey" PRIMARY KEY ("pessoaId","canal")
);

-- CreateTable
CREATE TABLE "registros" (
    "chave" TEXT NOT NULL,
    "dados" JSONB NOT NULL,
    "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registros_pkey" PRIMARY KEY ("chave")
);

-- CreateIndex
CREATE INDEX "sessoes_espacoId_idx" ON "sessoes"("espacoId");

-- CreateIndex
CREATE UNIQUE INDEX "pessoas_telefone_key" ON "pessoas"("telefone");

-- CreateIndex
CREATE UNIQUE INDEX "pessoas_espacoId_slug_key" ON "pessoas"("espacoId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "profissionais_convite_key" ON "profissionais"("convite");

-- CreateIndex
CREATE UNIQUE INDEX "profissionais_espacoId_slug_key" ON "profissionais"("espacoId", "slug");

-- CreateIndex
CREATE INDEX "compras_pessoaId_quando_idx" ON "compras"("pessoaId", "quando");

-- CreateIndex
CREATE INDEX "dividas_pessoaId_idx" ON "dividas"("pessoaId");

-- CreateIndex
CREATE INDEX "faturas_pessoaId_mes_idx" ON "faturas"("pessoaId", "mes");

-- CreateIndex
CREATE INDEX "lancamentos_faturaId_idx" ON "lancamentos"("faturaId");

-- CreateIndex
CREATE INDEX "anotacoes_pessoaId_idx" ON "anotacoes"("pessoaId");

-- CreateIndex
CREATE INDEX "avisos_pessoaId_quando_idx" ON "avisos"("pessoaId", "quando");

-- CreateIndex
CREATE INDEX "mensagens_pessoaId_canal_quando_idx" ON "mensagens"("pessoaId", "canal", "quando");

-- AddForeignKey
ALTER TABLE "sessoes" ADD CONSTRAINT "sessoes_espacoId_fkey" FOREIGN KEY ("espacoId") REFERENCES "espacos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessoes" ADD CONSTRAINT "sessoes_pessoaId_fkey" FOREIGN KEY ("pessoaId") REFERENCES "pessoas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessoes" ADD CONSTRAINT "sessoes_profissionalId_fkey" FOREIGN KEY ("profissionalId") REFERENCES "profissionais"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pessoas" ADD CONSTRAINT "pessoas_espacoId_fkey" FOREIGN KEY ("espacoId") REFERENCES "espacos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profissionais" ADD CONSTRAINT "profissionais_espacoId_fkey" FOREIGN KEY ("espacoId") REFERENCES "espacos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acompanhamentos" ADD CONSTRAINT "acompanhamentos_pessoaId_fkey" FOREIGN KEY ("pessoaId") REFERENCES "pessoas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acompanhamentos" ADD CONSTRAINT "acompanhamentos_profissionalId_fkey" FOREIGN KEY ("profissionalId") REFERENCES "profissionais"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compras" ADD CONSTRAINT "compras_pessoaId_fkey" FOREIGN KEY ("pessoaId") REFERENCES "pessoas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dividas" ADD CONSTRAINT "dividas_pessoaId_fkey" FOREIGN KEY ("pessoaId") REFERENCES "pessoas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planos" ADD CONSTRAINT "planos_pessoaId_fkey" FOREIGN KEY ("pessoaId") REFERENCES "pessoas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faturas" ADD CONSTRAINT "faturas_pessoaId_fkey" FOREIGN KEY ("pessoaId") REFERENCES "pessoas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamentos" ADD CONSTRAINT "lancamentos_faturaId_fkey" FOREIGN KEY ("faturaId") REFERENCES "faturas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamentos" ADD CONSTRAINT "lancamentos_compraId_fkey" FOREIGN KEY ("compraId") REFERENCES "compras"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memorias" ADD CONSTRAINT "memorias_pessoaId_fkey" FOREIGN KEY ("pessoaId") REFERENCES "pessoas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anotacoes" ADD CONSTRAINT "anotacoes_pessoaId_fkey" FOREIGN KEY ("pessoaId") REFERENCES "pessoas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anotacoes" ADD CONSTRAINT "anotacoes_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "profissionais"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avisos" ADD CONSTRAINT "avisos_pessoaId_fkey" FOREIGN KEY ("pessoaId") REFERENCES "pessoas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensagens" ADD CONSTRAINT "mensagens_pessoaId_fkey" FOREIGN KEY ("pessoaId") REFERENCES "pessoas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estados_conversa" ADD CONSTRAINT "estados_conversa_pessoaId_fkey" FOREIGN KEY ("pessoaId") REFERENCES "pessoas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
