import { TelaDividas } from "@/components/desafoga/telas/dividas";
import { PaginaDoPaciente } from "../paciente";

/** Carrega no navegador depois de conferir a sessão; ver o layout da área. */
export const instant = false;

export default function DividasDoPaciente({ params }: PageProps<"/painel/[id]/dividas">) {
  return <PaginaDoPaciente params={params} tela={(id) => <TelaDividas pessoaId={id} area="responsavel" />} />;
}
