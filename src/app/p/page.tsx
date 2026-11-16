import type { Metadata } from "next";
import { PainelPeloLink } from "./painel-pelo-link";

export const metadata: Metadata = {
  title: "Luana: resumo geral",
  // O endereço carrega um código pessoal: não indexar nem repassar a outros sites.
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function Pagina() {
  return <PainelPeloLink />;
}
