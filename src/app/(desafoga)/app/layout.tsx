import { Moldura } from "@/components/desafoga/moldura/moldura";
import { ComSessao } from "@/components/desafoga/sessao";

/**
 * Tudo nesta área carrega no navegador depois de conferir a sessão (dados
 * pessoais não entram no HTML pré-renderizado). Por isso a validação de
 * navegação instantânea do Next não se aplica aqui.
 */
export const instant = false;

/** App de quem usa o Desafoga. */
export default function AppDaPessoa({ children }: { children: React.ReactNode }) {
  return (
    <ComSessao area="pessoa">
      <Moldura area="pessoa">{children}</Moldura>
    </ComSessao>
  );
}
