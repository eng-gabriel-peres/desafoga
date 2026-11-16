import { Moldura } from "@/components/desafoga/moldura/moldura";

/** Painel do profissional que acompanha as pessoas. */
export default function PainelDoResponsavel({ children }: { children: React.ReactNode }) {
  return <Moldura area="responsavel">{children}</Moldura>;
}
