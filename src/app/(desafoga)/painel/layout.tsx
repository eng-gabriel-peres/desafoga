import { Moldura } from "@/components/desafoga/moldura/moldura";
import { ComSessao } from "@/components/desafoga/sessao";

/**
 * Tudo nesta área carrega no navegador depois de conferir a sessão (dados
 * pessoais não entram no HTML pré-renderizado). Por isso a validação de
 * navegação instantânea do Next não se aplica aqui.
 */
export const instant = false;

/** Painel do profissional que acompanha as pessoas. */
export default function PainelDoResponsavel({ children }: { children: React.ReactNode }) {
  return (
    <ComSessao area="responsavel">
      <Moldura area="responsavel">{children}</Moldura>
    </ComSessao>
  );
}
