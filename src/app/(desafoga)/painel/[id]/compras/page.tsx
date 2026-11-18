import { TelaComprasDoPaciente } from "@/components/desafoga/telas/compras";
import { PaginaDoPaciente } from "../paciente";

/** Carrega no navegador depois de conferir a sessão; ver o layout da área. */
export const instant = false;

export default function ComprasDoPaciente({ params }: PageProps<"/painel/[id]/compras">) {
  return <PaginaDoPaciente params={params} tela={(id) => <TelaComprasDoPaciente pessoaId={id} />} />;
}
