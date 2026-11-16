import { Suspense, type ReactNode } from "react";
import { Carregando } from "@/components/desafoga/ui/blocos";

async function Conteudo({ params, tela }: { params: Promise<{ id: string }>; tela: (id: string) => ReactNode }) {
  const { id } = await params;
  return tela(id);
}

/** Lê o paciente da rota dentro de um Suspense, para a navegação não travar. */
export function PaginaDoPaciente({ params, tela }: { params: Promise<{ id: string }>; tela: (id: string) => ReactNode }) {
  return (
    <Suspense fallback={<Carregando />}>
      <Conteudo params={params} tela={tela} />
    </Suspense>
  );
}
