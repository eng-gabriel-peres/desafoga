import { Moldura } from "@/components/desafoga/moldura/moldura";

/** App de quem usa o Desafoga. */
export default function AppDaPessoa({ children }: { children: React.ReactNode }) {
  return <Moldura area="pessoa">{children}</Moldura>;
}
