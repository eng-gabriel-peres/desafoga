import { SoComRecurso } from "@/components/desafoga/so-com-recurso";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <SoComRecurso recurso="eventos" senao="/painel">
      {children}
    </SoComRecurso>
  );
}
