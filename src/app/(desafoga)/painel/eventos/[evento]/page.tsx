import { Suspense } from "react";
import { SalaDoEventoTela } from "@/components/desafoga/eventos/sala";
import { Carregando } from "@/components/desafoga/ui/blocos";

/** Carrega no navegador depois de conferir a sessão; ver o layout da área. */
export const instant = false;

async function Conteudo({ params }: { params: Promise<{ evento: string }> }) {
  const { evento } = await params;
  return <SalaDoEventoTela eventoId={evento} pessoaId={null} voltar="/painel/eventos" />;
}

export default function EventoDoProfissional({ params }: PageProps<"/painel/eventos/[evento]">) {
  return (
    <Suspense fallback={<Carregando />}>
      <Conteudo params={params} />
    </Suspense>
  );
}
