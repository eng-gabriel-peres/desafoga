import { TelaContas } from "@/components/desafoga/telas/contas";
import { PaginaDoPaciente } from "../paciente";

/** Carrega no navegador depois de conferir a sessão; ver o layout da área. */
export const instant = false;

export default function ContasDoPaciente({ params }: PageProps<"/painel/[id]/contas">) {
  return <PaginaDoPaciente params={params} tela={(id) => <TelaContas pessoaId={id} area="responsavel" />} />;
}
