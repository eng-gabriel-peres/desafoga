import { TelaFormularioDaMeta } from "@/components/desafoga/telas/formulario-da-meta";
import { ComParametros } from "../../../../parametros";

/** Carrega no navegador depois de conferir a sessão; ver o layout da área. */
export const instant = false;

export default function AjustarMeta({ params }: PageProps<"/app/metas/[metaId]/ajustar">) {
  return <ComParametros params={params} tela={({ metaId }) => <TelaFormularioDaMeta metaId={metaId} />} />;
}
