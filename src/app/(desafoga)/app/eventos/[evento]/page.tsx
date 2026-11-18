import { Suspense } from "react";
import { SalaDaPessoa } from "@/components/desafoga/eventos/paginas";
import { Carregando } from "@/components/desafoga/ui/blocos";

/** Carrega no navegador depois de conferir a sessão; ver o layout da área. */
export const instant = false;

async function Conteudo({ params }: { params: Promise<{ evento: string }> }) {
  const { evento } = await params;
  return <SalaDaPessoa eventoId={evento} />;
}

export default function Evento({ params }: PageProps<"/app/eventos/[evento]">) {
  return (
    <Suspense fallback={<Carregando />}>
      <Conteudo params={params} />
    </Suspense>
  );
}
