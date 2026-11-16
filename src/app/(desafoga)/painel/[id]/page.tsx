import { TelaResumo } from "@/components/desafoga/telas/resumo";
import { PaginaDoPaciente } from "./paciente";

/** Carrega no navegador depois de conferir a sessão; ver o layout da área. */
export const instant = false;

export default function Resumo({ params }: PageProps<"/painel/[id]">) {
  return <PaginaDoPaciente params={params} tela={(id) => <TelaResumo pessoaId={id} />} />;
}
