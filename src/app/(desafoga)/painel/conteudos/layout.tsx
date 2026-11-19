import { SoComRecurso } from "@/components/desafoga/so-com-recurso";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <SoComRecurso recurso="conteudos" senao="/painel">
      {children}
    </SoComRecurso>
  );
}
