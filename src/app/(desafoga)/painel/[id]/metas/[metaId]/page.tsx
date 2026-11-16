import { TelaDaMeta } from "@/components/desafoga/telas/meta";
import { ComParametros } from "../../../../parametros";

/** Carrega no navegador depois de conferir a sessão; ver o layout da área. */
export const instant = false;

export default function MetaDoPaciente({ params }: PageProps<"/painel/[id]/metas/[metaId]">) {
  return <ComParametros params={params} tela={({ id, metaId }) => <TelaDaMeta pessoaId={id} metaId={metaId} area="responsavel" />} />;
}
