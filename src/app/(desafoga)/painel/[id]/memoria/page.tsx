import { TelaMemoria } from "@/components/desafoga/telas/memoria";
import { PaginaDoPaciente, paramsDosPacientes } from "../paciente";

export const generateStaticParams = paramsDosPacientes;

export default function MemoriaDoPaciente({ params }: PageProps<"/painel/[id]/memoria">) {
  return <PaginaDoPaciente params={params} tela={(id) => <TelaMemoria pessoaId={id} />} />;
}
