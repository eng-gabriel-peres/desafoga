import { PESSOA_DA_DEMO } from "@/components/desafoga/moldura/navegacao";
import { TelaDividas } from "@/components/desafoga/telas/dividas";

export default function Dividas() {
  return <TelaDividas pessoaId={PESSOA_DA_DEMO} area="pessoa" />;
}
