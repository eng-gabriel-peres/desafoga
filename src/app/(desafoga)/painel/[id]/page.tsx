import { TelaResumo } from "@/components/desafoga/telas/resumo";
import { PaginaDoPaciente, paramsDosPacientes } from "./paciente";

export const generateStaticParams = paramsDosPacientes;

export default function Resumo({ params }: PageProps<"/painel/[id]">) {
  return <PaginaDoPaciente params={params} tela={(id) => <TelaResumo pessoaId={id} />} />;
}
