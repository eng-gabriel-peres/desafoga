import { HeartHandshake, Lightbulb, Target, TriangleAlert, Wallet, type LucideIcon } from "lucide-react";
import { quando } from "@/lib/formatar";
import type { Aviso, TipoAviso } from "@/services";

const ICONE: Record<TipoAviso, [LucideIcon, string]> = {
  "gasto-alto": [Wallet, "text-muted"],
  "nota-baixa": [TriangleAlert, "text-maybe"],
  sofrimento: [HeartHandshake, "text-bad"],
  sugestao: [Lightbulb, "text-primary"],
  meta: [Target, "text-good"],
};

export function ListaDeAvisos({ avisos, agora, vazio = "Nenhum aviso ainda." }: { avisos: Aviso[]; agora: Date; vazio?: string }) {
  if (!avisos.length) return <p className="py-2 text-[0.92rem] text-muted">{vazio}</p>;
  return (
    <ul>
      {avisos.map((a) => {
        const [Icone, cor] = ICONE[a.tipo];
        return (
          <li key={a.id} className="flex gap-3 border-b border-line py-3 last:border-0">
            <span aria-hidden="true" className={`grid size-9 shrink-0 place-items-center rounded-[10px] border border-line bg-surface2 ${cor}`}>
              <Icone className="size-[18px]" />
            </span>
            <div>
              <p className={a.tipo === "sofrimento" ? "font-bold" : ""}>{a.texto}</p>
              <time dateTime={a.quando} className="block text-[0.8rem] text-muted">
                {quando(a.quando, agora)}
              </time>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
