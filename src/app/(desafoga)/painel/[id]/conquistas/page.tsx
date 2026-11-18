import { TelaConquistasDoPaciente } from "@/components/desafoga/telas/conquistas";
import { PaginaDoPaciente } from "../paciente";

/** Carrega no navegador depois de conferir a sessão; ver o layout da área. */
export const instant = false;

export default function ConquistasDoPaciente({ params }: PageProps<"/painel/[id]/conquistas">) {
  return <PaginaDoPaciente params={params} tela={(id) => <TelaConquistasDoPaciente pessoaId={id} />} />;
}
