"use client";

import Link from "next/link";
import { situacaoDaMeta, type Meta } from "@/lib/finance";
import { Painel } from "../ui/blocos";
import { Anel, corDaMeta } from "./visual";

/** "Suas metas" na tela Hoje: até três anéis pequenos, cada um abre a meta. */
export function MetasEmMiniatura({ metas, agora }: { metas: Meta[]; agora: Date }) {
  return (
    <Painel
      titulo="Suas metas"
      acao={
        <Link href="/app/metas" className="text-[0.92rem] font-bold text-primary">
          Ver todas
        </Link>
      }
    >
      <ul className="grid grid-cols-3 gap-2">
        {metas.slice(0, 3).map((m) => {
          const s = situacaoDaMeta(m, agora);
          return (
            <li key={m.id}>
              <Link
                href={`/app/metas/${m.id}`}
                className="flex flex-col items-center gap-1.5 rounded-xl p-1 text-center text-[0.8rem] leading-tight font-bold text-ink no-underline hover:bg-surface2"
              >
                <Anel
                  fracao={s.fracao}
                  cor={corDaMeta(m.cor, s.concluida)}
                  tamanho={72}
                  espessura={9}
                  centro={<span className="text-[0.85rem] font-bold">{Math.floor(s.fracao * 100)}%</span>}
                />
                <span>
                  {m.nome}
                  <span className="sr-only">, {Math.floor(s.fracao * 100)}% guardado</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </Painel>
  );
}
