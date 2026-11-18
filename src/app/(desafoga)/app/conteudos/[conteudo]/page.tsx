import { Suspense } from "react";
import { TelaDoConteudo } from "@/components/desafoga/telas/conteudos";
import { Carregando } from "@/components/desafoga/ui/blocos";

/** Carrega no navegador depois de conferir a sessão; ver o layout da área. */
export const instant = false;

async function Conteudo({ params }: { params: Promise<{ conteudo: string }> }) {
  const { conteudo } = await params;
  return <TelaDoConteudo conteudoId={conteudo} />;
}

export default function Post({ params }: PageProps<"/app/conteudos/[conteudo]">) {
  return (
    <Suspense fallback={<Carregando />}>
      <Conteudo params={params} />
    </Suspense>
  );
}
