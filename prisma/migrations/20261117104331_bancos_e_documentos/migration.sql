-- AlterTable
ALTER TABLE "avisos" ADD COLUMN     "referencia" TEXT;

-- AlterTable
ALTER TABLE "compras" ADD COLUMN     "parceladaId" TEXT,
ADD COLUMN     "parcelas" INTEGER,
ADD COLUMN     "valorDaParcela" INTEGER,
ALTER COLUMN "emocao" DROP NOT NULL,
ALTER COLUMN "necessidade" DROP NOT NULL;

-- AlterTable
ALTER TABLE "dividas" ADD COLUMN     "atualizadaEm" TIMESTAMP(3),
ADD COLUMN     "cet" DOUBLE PRECISION,
ADD COLUMN     "chave" TEXT,
ADD COLUMN     "conexaoId" TEXT,
ADD COLUMN     "confira" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "correcoes" JSONB,
ADD COLUMN     "faltaPagarComJuros" INTEGER,
ADD COLUMN     "fonte" TEXT,
ADD COLUMN     "instituicao" TEXT,
ADD COLUMN     "origem" TEXT NOT NULL DEFAULT 'manual',
ADD COLUMN     "parcelasRestantes" INTEGER,
ADD COLUMN     "pluggyLoanId" TEXT,
ADD COLUMN     "temSeguro" BOOLEAN,
ADD COLUMN     "vencido" INTEGER;

-- AlterTable
ALTER TABLE "faturas" ADD COLUMN     "contaId" TEXT,
ADD COLUMN     "fonte" TEXT NOT NULL DEFAULT 'documento',
ADD COLUMN     "foraDosCalculos" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pagamentoMinimo" INTEGER,
ADD COLUMN     "pluggyBillId" TEXT,
ADD COLUMN     "taxaRotativoMensal" DOUBLE PRECISION,
ADD COLUMN     "total" INTEGER,
ADD COLUMN     "vencimento" TEXT;

-- AlterTable
ALTER TABLE "lancamentos" ADD COLUMN     "parcela" INTEGER,
ADD COLUMN     "totalParcelas" INTEGER;

-- AlterTable
ALTER TABLE "metas" ADD COLUMN     "investimentos" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "pessoas" ADD COLUMN     "modoComprasDoBanco" TEXT NOT NULL DEFAULT 'revisar';

-- CreateTable
CREATE TABLE "conexoes_bancarias" (
    "id" TEXT NOT NULL,
    "pessoaId" TEXT NOT NULL,
    "pluggyItemId" TEXT,
    "banco" TEXT NOT NULL,
    "logo" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ok',
    "erro" TEXT,
    "ultimaSincronizacao" TIMESTAMP(3),
    "ultimoPedidoDeAtualizacao" TIMESTAMP(3),
    "sincronizandoDesde" TIMESTAMP(3),
    "consentimentoAte" TIMESTAMP(3),
    "cpfDoTitular" TEXT,
    "conectadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conexoes_bancarias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contas_bancarias" (
    "id" TEXT NOT NULL,
    "conexaoId" TEXT NOT NULL,
    "pluggyAccountId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "saldo" INTEGER NOT NULL,
    "limite" INTEGER,
    "limiteDisponivel" INTEGER,
    "fechamento" TEXT,
    "vencimento" TEXT,
    "chequeEspecialUsado" INTEGER,
    "chequeEspecialLimite" INTEGER,

    CONSTRAINT "contas_bancarias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimentos" (
    "id" TEXT NOT NULL,
    "pessoaId" TEXT NOT NULL,
    "contaId" TEXT NOT NULL,
    "pluggyId" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "descricaoOriginal" TEXT NOT NULL,
    "valor" INTEGER NOT NULL,
    "direcao" TEXT NOT NULL,
    "natureza" TEXT NOT NULL,
    "categoria" TEXT,
    "categoriaPluggy" TEXT,
    "situacao" TEXT NOT NULL,
    "compraId" TEXT,
    "parceladaId" TEXT,
    "parcela" INTEGER,
    "totalParcelas" INTEGER,
    "valorTotalDaCompra" INTEGER,
    "compradaEm" TEXT,
    "faturaPrevista" TEXT,
    "cnpj" TEXT,
    "mcc" INTEGER,
    "documentoContraparte" TEXT,
    "jurosBoleto" INTEGER,
    "pendente" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compras_parceladas" (
    "id" TEXT NOT NULL,
    "pessoaId" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "origem" TEXT NOT NULL,
    "fonte" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "lojaOriginal" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "valorTotal" INTEGER NOT NULL,
    "valorParcela" INTEGER NOT NULL,
    "totalParcelas" INTEGER NOT NULL,
    "mesDaPrimeira" TEXT NOT NULL,
    "compradaEm" TEXT NOT NULL,
    "compradaEmEstimada" BOOLEAN NOT NULL DEFAULT false,
    "compraId" TEXT,
    "parcelasVistas" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "avisada" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "compras_parceladas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sugestoes" (
    "id" TEXT NOT NULL,
    "pessoaId" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "dados" JSONB NOT NULL,
    "situacao" TEXT NOT NULL DEFAULT 'aberta',
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadaEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sugestoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "regras_do_banco" (
    "id" TEXT NOT NULL,
    "pessoaId" TEXT NOT NULL,
    "padrao" TEXT NOT NULL,
    "efeito" JSONB NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "regras_do_banco_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "conexoes_bancarias_pluggyItemId_key" ON "conexoes_bancarias"("pluggyItemId");

-- CreateIndex
CREATE INDEX "conexoes_bancarias_pessoaId_idx" ON "conexoes_bancarias"("pessoaId");

-- CreateIndex
CREATE UNIQUE INDEX "contas_bancarias_pluggyAccountId_key" ON "contas_bancarias"("pluggyAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "movimentos_pluggyId_key" ON "movimentos"("pluggyId");

-- CreateIndex
CREATE INDEX "movimentos_pessoaId_data_idx" ON "movimentos"("pessoaId", "data");

-- CreateIndex
CREATE UNIQUE INDEX "compras_parceladas_pessoaId_chave_key" ON "compras_parceladas"("pessoaId", "chave");

-- CreateIndex
CREATE UNIQUE INDEX "sugestoes_pessoaId_chave_key" ON "sugestoes"("pessoaId", "chave");

-- CreateIndex
CREATE UNIQUE INDEX "regras_do_banco_pessoaId_padrao_key" ON "regras_do_banco"("pessoaId", "padrao");

-- CreateIndex
CREATE UNIQUE INDEX "dividas_pluggyLoanId_key" ON "dividas"("pluggyLoanId");

-- CreateIndex
CREATE UNIQUE INDEX "faturas_pluggyBillId_key" ON "faturas"("pluggyBillId");

-- AddForeignKey
ALTER TABLE "conexoes_bancarias" ADD CONSTRAINT "conexoes_bancarias_pessoaId_fkey" FOREIGN KEY ("pessoaId") REFERENCES "pessoas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contas_bancarias" ADD CONSTRAINT "contas_bancarias_conexaoId_fkey" FOREIGN KEY ("conexaoId") REFERENCES "conexoes_bancarias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentos" ADD CONSTRAINT "movimentos_pessoaId_fkey" FOREIGN KEY ("pessoaId") REFERENCES "pessoas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentos" ADD CONSTRAINT "movimentos_contaId_fkey" FOREIGN KEY ("contaId") REFERENCES "contas_bancarias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentos" ADD CONSTRAINT "movimentos_compraId_fkey" FOREIGN KEY ("compraId") REFERENCES "compras"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentos" ADD CONSTRAINT "movimentos_parceladaId_fkey" FOREIGN KEY ("parceladaId") REFERENCES "compras_parceladas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compras_parceladas" ADD CONSTRAINT "compras_parceladas_pessoaId_fkey" FOREIGN KEY ("pessoaId") REFERENCES "pessoas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sugestoes" ADD CONSTRAINT "sugestoes_pessoaId_fkey" FOREIGN KEY ("pessoaId") REFERENCES "pessoas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "regras_do_banco" ADD CONSTRAINT "regras_do_banco_pessoaId_fkey" FOREIGN KEY ("pessoaId") REFERENCES "pessoas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

