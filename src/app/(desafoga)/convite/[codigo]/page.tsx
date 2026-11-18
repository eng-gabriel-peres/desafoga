import { Suspense } from "react";
import { ConviteParaEvento } from "@/components/desafoga/eventos/convite";

export const metadata = { title: "Convite · Desafoga" };

async function Conteudo({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  return <ConviteParaEvento codigo={codigo} />;
}

/** Link de convite de um evento: público, para quem ainda não participa. */
export default function Convite({ params }: PageProps<"/convite/[codigo]">) {
  return (
    <Suspense>
      <Conteudo params={params} />
    </Suspense>
  );
}
