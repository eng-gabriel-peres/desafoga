
-- CreateTable
CREATE TABLE "eventos" (
    "id" TEXT NOT NULL,
    "profissionalId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT NOT NULL DEFAULT '',
    "regra" TEXT,
    "categoria" TEXT,
    "limite" INTEGER,
    "inicio" TEXT,
    "fim" TEXT,
    "data" TEXT,
    "hora" TEXT,
    "local" TEXT,
    "premio" TEXT NOT NULL DEFAULT '',
    "mostrarRanking" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eventos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "participantes_dos_eventos" (
    "eventoId" TEXT NOT NULL,
    "pessoaId" TEXT NOT NULL,
    "entrouEm" TEXT NOT NULL,
    "resposta" TEXT,

    CONSTRAINT "participantes_dos_eventos_pkey" PRIMARY KEY ("eventoId","pessoaId")
);

-- CreateTable
CREATE TABLE "posts_dos_eventos" (
    "id" TEXT NOT NULL,
    "eventoId" TEXT NOT NULL,
    "pessoaId" TEXT,
    "profissionalId" TEXT,
    "tipo" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "fixado" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "posts_dos_eventos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "apoios_dos_posts" (
    "postId" TEXT NOT NULL,
    "quem" TEXT NOT NULL,

    CONSTRAINT "apoios_dos_posts_pkey" PRIMARY KEY ("postId","quem")
);

-- CreateIndex
CREATE INDEX "eventos_profissionalId_idx" ON "eventos"("profissionalId");

-- CreateIndex
CREATE INDEX "participantes_dos_eventos_pessoaId_idx" ON "participantes_dos_eventos"("pessoaId");

-- CreateIndex
CREATE INDEX "posts_dos_eventos_eventoId_criadoEm_idx" ON "posts_dos_eventos"("eventoId", "criadoEm");

-- AddForeignKey
ALTER TABLE "eventos" ADD CONSTRAINT "eventos_profissionalId_fkey" FOREIGN KEY ("profissionalId") REFERENCES "profissionais"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participantes_dos_eventos" ADD CONSTRAINT "participantes_dos_eventos_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "eventos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participantes_dos_eventos" ADD CONSTRAINT "participantes_dos_eventos_pessoaId_fkey" FOREIGN KEY ("pessoaId") REFERENCES "pessoas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts_dos_eventos" ADD CONSTRAINT "posts_dos_eventos_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "eventos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts_dos_eventos" ADD CONSTRAINT "posts_dos_eventos_pessoaId_fkey" FOREIGN KEY ("pessoaId") REFERENCES "pessoas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts_dos_eventos" ADD CONSTRAINT "posts_dos_eventos_profissionalId_fkey" FOREIGN KEY ("profissionalId") REFERENCES "profissionais"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apoios_dos_posts" ADD CONSTRAINT "apoios_dos_posts_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts_dos_eventos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

