import { TelaAvisosDoPaciente } from "@/components/desafoga/telas/avisos-do-paciente";
import { PaginaDoPaciente } from "../paciente";

/** Carrega no navegador depois de conferir a sessão; ver o layout da área. */
export const instant = false;

export default function AvisosDoPaciente({ params }: PageProps<"/painel/[id]/avisos">) {
  return <PaginaDoPaciente params={params} tela={(id) => <TelaAvisosDoPaciente pessoaId={id} />} />;
}
