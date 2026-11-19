import { SoComRecurso } from "@/components/desafoga/so-com-recurso";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <SoComRecurso recurso="conquistas" senao="/app/hoje">
      {children}
    </SoComRecurso>
  );
}
