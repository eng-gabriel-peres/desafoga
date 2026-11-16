import { Suspense, type ReactNode } from "react";
import { Carregando } from "@/components/desafoga/ui/blocos";

async function Conteudo<P>({ params, tela }: { params: Promise<P>; tela: (p: P) => ReactNode }) {
  return tela(await params);
}

/** Lê os parâmetros da rota dentro de um Suspense, para a navegação não travar. */
export function ComParametros<P>({ params, tela }: { params: Promise<P>; tela: (p: P) => ReactNode }) {
  return (
    <Suspense fallback={<Carregando />}>
      <Conteudo params={params} tela={tela} />
    </Suspense>
  );
}
