import { TelaDaMeta } from "@/components/desafoga/telas/meta";
import { ComParametros } from "../../../parametros";

/** Carrega no navegador depois de conferir a sessão; ver o layout da área. */
export const instant = false;

export default function Meta({ params }: PageProps<"/app/metas/[metaId]">) {
  return <ComParametros params={params} tela={({ metaId }) => <TelaDaMeta metaId={metaId} />} />;
}
