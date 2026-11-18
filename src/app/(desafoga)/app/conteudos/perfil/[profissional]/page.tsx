import { Suspense } from "react";
import { TelaPerfilDoProfissional } from "@/components/desafoga/telas/conteudos";
import { Carregando } from "@/components/desafoga/ui/blocos";

/** Carrega no navegador depois de conferir a sessão; ver o layout da área. */
export const instant = false;

async function Conteudo({ params }: { params: Promise<{ profissional: string }> }) {
  const { profissional } = await params;
  return <TelaPerfilDoProfissional profissionalId={profissional} />;
}

export default function Perfil({ params }: PageProps<"/app/conteudos/perfil/[profissional]">) {
  return (
    <Suspense fallback={<Carregando />}>
      <Conteudo params={params} />
    </Suspense>
  );
}
