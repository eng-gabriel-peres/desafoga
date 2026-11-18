import { Check, CreditCard, FileSearch, Frown, Gauge, KeyRound, ShieldAlert, HeartHandshake, Lightbulb, Target, TriangleAlert, Trophy, Wallet, BarChart3, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { quando } from "@/lib/formatar";
import type { Aviso, TipoAviso } from "@/services";

export const ICONE_DO_AVISO: Record<TipoAviso, [LucideIcon, string]> = {
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
  conquista: [Trophy, "text-good"],
  "resumo-semana": [BarChart3, "text-primary"],
};

/** Para onde o aviso leva (na área da pessoa). */
export function linkDoAviso(a: Aviso): { href: string; rotulo: string } | null {
  if (a.tipo === "compra-banco") return { href: "/app/hoje", rotulo: "Registrar em Hoje" };
  if (a.tipo === "limite-cartao" || a.tipo === "consentimento") return { href: "/app/contas", rotulo: "Ver em Contas" };
  if (a.tipo === "divida-encontrada" || a.tipo === "seguro") return { href: "/app/dividas", rotulo: "Conferir em Dívidas" };
  return null;
}

/** `aoVer`: mostra "Marcar como visto" nos não vistos (no sino). */
export function ListaDeAvisos({ avisos, agora, vazio = "Nenhum aviso ainda.", aoVer }: { avisos: Aviso[]; agora: Date; vazio?: string; aoVer?: (id: string) => void }) {
  if (!avisos.length) return <p className="py-2 text-[0.92rem] text-muted">{vazio}</p>;
  return (
    <ul>
      {avisos.map((a) => {
        const [Icone, cor] = ICONE_DO_AVISO[a.tipo];
        const novo = aoVer && a.lido === false;
        return (
          <li key={a.id} className={`-mx-2 flex gap-3 rounded-xl border-b border-line px-2 py-3 last:border-0 ${novo ? "bg-primary-soft/50" : ""}`}>
            <span aria-hidden="true" className={`grid size-9 shrink-0 place-items-center rounded-[10px] border border-line bg-surface2 ${cor}`}>
              <Icone className="size-[18px]" />
            </span>
            <div className="min-w-0 flex-1">
              <p className={a.tipo === "sofrimento" || novo ? "font-bold" : ""}>
                {novo && <span className="sr-only">Novo: </span>}
                {a.texto}
              </p>
              {linkDoAviso(a) && (
                <Link href={linkDoAviso(a)!.href} onClick={() => novo && aoVer?.(a.id)} className="text-[0.88rem] font-bold text-primary">
                  {linkDoAviso(a)!.rotulo}
                </Link>
              )}
              <p className="flex flex-wrap items-center gap-x-3 text-[0.8rem] text-muted">
                <time dateTime={a.quando}>{quando(a.quando, agora)}</time>
                {novo && (
                  <button type="button" onClick={() => aoVer(a.id)} className="inline-flex items-center gap-1 font-bold text-primary hover:underline">
                    <Check aria-hidden="true" className="size-3.5" /> Marcar como visto
                  </button>
                )}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
