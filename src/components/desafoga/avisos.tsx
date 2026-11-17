import { CreditCard, FileSearch, Frown, Gauge, KeyRound, ShieldAlert, HeartHandshake, Lightbulb, Target, TriangleAlert, Wallet, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { quando } from "@/lib/formatar";
import type { Aviso, TipoAviso } from "@/services";

const ICONE: Record<TipoAviso, [LucideIcon, string]> = {
  "gasto-alto": [Wallet, "text-muted"],
  "nota-baixa": [TriangleAlert, "text-maybe"],
  sofrimento: [HeartHandshake, "text-bad"],
  sugestao: [Lightbulb, "text-primary"],
  meta: [Target, "text-good"],
  checkin: [Frown, "text-maybe"],
  "compra-banco": [CreditCard, "text-primary"],
  "divida-encontrada": [FileSearch, "text-maybe"],
  "limite-cartao": [Gauge, "text-maybe"],
  consentimento: [KeyRound, "text-maybe"],
  seguro: [ShieldAlert, "text-maybe"],
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
              {a.tipo === "compra-banco" && (
                <Link href="/app/hoje" className="text-[0.88rem] font-bold text-primary">
                  Registrar em Hoje
                </Link>
              )}
              {(a.tipo === "limite-cartao" || a.tipo === "consentimento") && (
                <Link href="/app/contas" className="text-[0.88rem] font-bold text-primary">
                  Ver em Contas
                </Link>
              )}
              {(a.tipo === "divida-encontrada" || a.tipo === "seguro") && (
                <Link href="/app/dividas" className="text-[0.88rem] font-bold text-primary">
                  Conferir em Dívidas
                </Link>
              )}
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
