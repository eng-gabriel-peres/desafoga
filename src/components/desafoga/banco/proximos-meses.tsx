"use client";

import { PartyPopper } from "lucide-react";
import { useState } from "react";
import { cartoesDasFontes, proximosMeses, type ContaFixa, type Divida, type Fatura, type Renda } from "@/lib/finance";
import { reais } from "@/lib/formatar";
import type { CompraParcelada, ConexaoBancaria, Plano } from "@/services";
import { Painel, Sub } from "../ui/blocos";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const nomeDoMes = (mes: string) => `${MESES[Number(mes.slice(5, 7)) - 1]}${mes.slice(2, 4) !== String(new Date().getFullYear()).slice(2) ? `/${mes.slice(2, 4)}` : ""}`;

/**
 * Quanto já está comprometido em cada um dos próximos 12 meses: contas
 * fixas, faturas (com as parcelas dentro) e dívidas, e quando cada coisa acaba.
 */
export function ProximosMeses({
  contas,
  dividas,
  plano,
  parceladas,
  conexoes,
  faturas,
  renda,
  agora,
}: {
  contas: ContaFixa[];
  dividas: Divida[];
  plano: Plano;
  parceladas: CompraParcelada[];
  conexoes: ConexaoBancaria[];
  faturas: Fatura[];
  renda: Renda | null;
  agora: Date;
}) {
  const [aberto, setAberto] = useState<string | null>(null);
  const cartoes = cartoesDasFontes(conexoes.flatMap((c) => c.contas), faturas);
  const meses = proximosMeses({ contas, dividas, plano, parceladas, cartoes, renda }, agora);
  if (!meses.some((m) => m.total > 0)) return null;
  const teto = Math.max(...meses.map((m) => Math.max(m.total, m.renda ?? 0)), 1);

  return (
    <Painel titulo="Próximos meses">
      <Sub className="mb-2">{renda ? "Quanto já está comprometido em cada mês, perto da sua renda." : "Quanto já está comprometido em cada mês. Informe a renda para ver o que sobra."}</Sub>
      <ul>
        {meses.map((m) => {
          const passou = m.renda !== null && m.total > m.renda;
          const largura = Math.round((m.total / teto) * 100);
          const expandido = aberto === m.mes;
          return (
            <li key={m.mes} className="border-b border-line py-2 last:border-0">
              <button
                type="button"
                aria-expanded={expandido}
                onClick={() => setAberto(expandido ? null : m.mes)}
                className="grid w-full grid-cols-[3.2rem_minmax(0,1fr)_auto] items-center gap-2 text-left"
              >
                <b>{nomeDoMes(m.mes)}</b>
                <span aria-hidden="true" className="relative h-3 overflow-hidden rounded-full bg-surface2">
                  <span className={`absolute inset-y-0 left-0 rounded-full ${passou ? "bg-bad" : "bg-primary"}`} style={{ width: `${largura}%` }} />
                  {m.renda !== null && <span className="absolute inset-y-0 w-0.5 bg-ink/60" style={{ left: `${Math.round((m.renda / teto) * 100)}%` }} />}
                </span>
                <span className="text-right">
                  <b>{reais(m.total)}</b>
                  {m.sobra !== null && <span className={`block text-[0.78rem] ${m.sobra < 0 ? "text-bad" : "text-muted"}`}>{m.sobra < 0 ? `faltam ${reais(-m.sobra)}` : `sobram ${reais(m.sobra)}`}</span>}
                </span>
              </button>
              {m.terminam.length > 0 && (
                <p className="mt-1 ml-[3.7rem] flex items-center gap-1.5 text-[0.82rem] text-good">
                  <PartyPopper aria-hidden="true" className="size-3.5" /> Termina: {m.terminam.join(", ")}
                </p>
              )}
              {expandido && (
                <ul className="mt-1.5 ml-[3.7rem] grid gap-1 text-[0.88rem]">
                  {m.itens.map((i, n) => (
                    <li key={n} className="flex justify-between gap-2">
                      <span className="min-w-0 truncate">
                        {i.nome}
                        {i.detalhe ? <span className="text-muted"> · {i.detalhe}</span> : null}
                        {i.previsto ? <span className="text-muted"> · previsto</span> : null}
                      </span>
                      <span>{reais(i.valor)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </Painel>
  );
}
