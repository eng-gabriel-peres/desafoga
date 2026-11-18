
-- CreateTable
CREATE TABLE "avisos_lidos" (
    "avisoId" TEXT NOT NULL,
    "quem" TEXT NOT NULL,

    CONSTRAINT "avisos_lidos_pkey" PRIMARY KEY ("avisoId","quem")
);

-- AddForeignKey
ALTER TABLE "avisos_lidos" ADD CONSTRAINT "avisos_lidos_avisoId_fkey" FOREIGN KEY ("avisoId") REFERENCES "avisos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

