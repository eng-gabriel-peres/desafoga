import { TelaDividas } from "@/components/desafoga/telas/dividas";
import { PaginaDoPaciente, paramsDosPacientes } from "../paciente";

export const generateStaticParams = paramsDosPacientes;

export default function DividasDoPaciente({ params }: PageProps<"/painel/[id]/dividas">) {
  return <PaginaDoPaciente params={params} tela={(id) => <TelaDividas pessoaId={id} area="responsavel" />} />;
}
