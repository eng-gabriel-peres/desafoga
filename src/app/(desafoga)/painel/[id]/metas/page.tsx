import { TelaMetas } from "@/components/desafoga/telas/metas";
import { PaginaDoPaciente } from "../paciente";

/** Carrega no navegador depois de conferir a sessão; ver o layout da área. */
export const instant = false;

export default function MetasDoPaciente({ params }: PageProps<"/painel/[id]/metas">) {
  return <PaginaDoPaciente params={params} tela={(id) => <TelaMetas pessoaId={id} area="responsavel" />} />;
}
