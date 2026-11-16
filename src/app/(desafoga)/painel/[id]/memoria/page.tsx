import { TelaMemoria } from "@/components/desafoga/telas/memoria";
import { PaginaDoPaciente } from "../paciente";

/** Carrega no navegador depois de conferir a sessão; ver o layout da área. */
export const instant = false;

export default function MemoriaDoPaciente({ params }: PageProps<"/painel/[id]/memoria">) {
  return <PaginaDoPaciente params={params} tela={(id) => <TelaMemoria pessoaId={id} />} />;
}
