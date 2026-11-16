/** Blocos de emoção: nota do dia, linha de compra, semana e padrões. */
import { Moon, Wallet } from "lucide-react";
import {
  emocaoDaNota,
  rotuloDaNota,
  type Compra,
  type DiaResumo,
  type Padroes,
} from "@/lib/finance";
import { umaCasa } from "@/lib/assistente/textos";
import { diaDaSemanaCurto, hora, nomeDoDia, reais } from "@/lib/formatar";
import { ICONE_DA_CATEGORIA } from "./categorias";
import { Carinha, COR_DA_EMOCAO, RostoSvg } from "./ui/carinha";
import { EtiquetaNecessidade } from "./ui/blocos";

/**
 * Nota do dia: carinha grande, número e escala de 1 a 5 com marcador.
 * `sujeito` é "você estava" ou "Ana estava".
 */
export function NotaDoDia({ nota, quantidade, sujeito }: { nota: number | null; quantidade: number; sujeito: string }) {
  if (nota === null) {
    return (
      <section aria-label="Nota do dia" className="rounded-3xl border-2 border-line bg-surface p-5">
        <div className="flex items-center gap-4">
          <span aria-hidden="true" className="grid size-20 shrink-0 place-items-center rounded-full border-[3px] border-dashed border-line text-[2rem] text-muted">
            –
          </span>
          <div>
            <p className="font-bold text-muted">Nota do dia</p>
            <p className="text-[1.15rem] font-bold">Ainda sem compras hoje</p>
          </div>
        </div>
        <p className="mt-3 text-[0.92rem] text-muted">
          A nota aparece com a primeira compra registrada. Ela é a média de como {sujeito} em cada compra do dia.
        </p>
      </section>
    );
  }
  const emocao = emocaoDaNota(nota);
  const cor = COR_DA_EMOCAO[emocao];
  const posicao = ((nota - 1) / 4) * 100;
  return (
    <section
      aria-label={`Nota do dia: ${umaCasa(nota)} de 5, ${rotuloDaNota(nota)}`}
      className="rounded-3xl border-2 bg-surface p-5"
      style={{ borderColor: `color-mix(in srgb, ${cor} 55%, var(--line))` }}
    >
      <div className="flex items-center gap-4">
        <Carinha emocao={emocao} tamanho="lg" rotulo={false} />
        <div>
          <p className="font-bold text-muted">Nota do dia</p>
          <p className="text-[3.2rem] leading-none font-bold tracking-tight desk:text-[4rem]">
            {umaCasa(nota)}
            <small className="ml-1 text-[1.1rem] font-normal tracking-normal text-muted">de 5</small>
          </p>
          <p className="mt-1 text-[1.15rem] font-bold">{rotuloDaNota(nota)}</p>
        </div>
      </div>
      <div aria-hidden="true" className="relative mt-5 grid grid-cols-5 gap-1">
        {([1, 2, 3, 4, 5] as const).map((e) => (
          <span key={e} className="h-3 rounded-md" style={{ background: COR_DA_EMOCAO[e] }} />
        ))}
        <span
          className="absolute -top-[7px] size-[26px] -translate-x-1/2 rounded-full border-4 border-ink bg-surface"
          style={{ left: `${posicao}%` }}
        />
      </div>
      <div aria-hidden="true" className="mt-1.5 flex justify-between text-[0.85rem] text-muted">
        <span>Muito triste</span>
        <span>Muito feliz</span>
      </div>
      <p className="mt-3 text-[0.92rem] text-muted">
        Média de como {sujeito} {quantidade === 1 ? "na compra de hoje" : `nas ${quantidade} compras de hoje`}.
      </p>
    </section>
  );
}

export function LinhaDeCompra({ compra, semNecessidade }: { compra: Compra; semNecessidade?: boolean }) {
  const Icone = ICONE_DA_CATEGORIA[compra.categoria];
  const via = compra.via === "whatsapp" ? " · pelo WhatsApp" : compra.via === "fatura" ? " · pela fatura" : "";
  return (
    <li className="grid grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-line py-3 last:border-0">
      <Carinha emocao={compra.emocao} />
      <div className="min-w-0">
        <p className="font-bold">{compra.item}</p>
        <p className="flex flex-wrap items-center gap-1 text-[0.85rem] text-muted">
          {hora(compra.quando)} · <Icone aria-hidden="true" className="size-3.5" /> {compra.categoria}
          {via}
        </p>
      </div>
      <div className="text-right">
        <b>{reais(compra.valor)}</b>
        {!semNecessidade && (
          <div className="mt-1">
            <EtiquetaNecessidade necessidade={compra.necessidade} />
          </div>
        )}
      </div>
    </li>
  );
}

/** Sete dias lado a lado: carinha da nota e barra do gasto. */
export function FaixaDaSemana({ dias, agora, sujeito }: { dias: DiaResumo[]; agora: Date; sujeito: string }) {
  const maior = Math.max(1, ...dias.map((d) => d.gasto));
  return (
    <>
      <p className="mb-3 text-[0.9rem] text-muted">Carinha: como {sujeito} ao comprar. Barra: quanto gastou.</p>
      <ol className="grid grid-cols-7 gap-1 text-center">
        {dias.map((d, i) => {
          const hoje = i === dias.length - 1;
          const nome = nomeDoDia(d.chave, agora);
          return (
            <li
              key={d.chave}
              aria-label={`${nome}: ${d.nota === null ? "sem compras" : `nota ${umaCasa(d.nota)}, gasto ${reais(d.gasto)}`}`}
              className="flex min-w-0 flex-col items-center gap-1"
            >
              {d.nota === null ? (
                <span aria-hidden="true" className="grid size-[38px] place-items-center rounded-full border-2 border-dashed border-line text-muted desk:size-[46px]">
                  –
                </span>
              ) : (
                <Carinha emocao={emocaoDaNota(d.nota)} tamanho="sm" rotulo={false} className="desk:size-[46px]" />
              )}
              <span aria-hidden="true" className="text-[0.9rem] font-bold">
                {d.nota === null ? "–" : umaCasa(d.nota)}
              </span>
              <span aria-hidden="true" className="mt-1 flex h-21 w-full items-end justify-center desk:h-36">
                <span
                  className="w-[62%] max-w-[46px] rounded-t-md rounded-b-sm bg-primary"
                  style={{ height: d.gasto ? `${Math.max(4, Math.round((d.gasto / maior) * 100))}%` : 0 }}
                />
              </span>
              <span aria-hidden="true" className="text-[0.72rem] whitespace-nowrap text-muted desk:text-[0.82rem]">
                {d.gasto ? (
                  <>
                    <span className="hidden desk:inline">R$ </span>
                    {Math.round(d.gasto / 100)}
                  </>
                ) : (
                  "–"
                )}
              </span>
              <span aria-hidden="true" className={`text-[0.85rem] font-bold ${hoje ? "text-primary" : ""}`}>
                {hoje ? "Hoje" : diaDaSemanaCurto(d.chave)}
              </span>
            </li>
          );
        })}
      </ol>
    </>
  );
}

/** Padrões em linguagem simples. Os números vêm de `padroesDeCompra`. */
export function ListaDePadroes({ padroes, sujeito }: { padroes: Padroes; sujeito: string }) {
  const itens: { icone: React.ReactNode; texto: string }[] = [];
  if (padroes.tristes) {
    itens.push({
      icone: <Carinha emocao={2} tamanho="xs" rotulo={false} />,
      texto: `Quando ${sujeito} triste, ${padroes.tristes.deCada10} de cada 10 compras não eram necessárias.`,
    });
  }
  if (padroes.felizes) {
    itens.push({
      icone: <Carinha emocao={4} tamanho="xs" rotulo={false} />,
      texto: `Quando ${sujeito} feliz, foram ${padroes.felizes.deCada10} de cada 10.`,
    });
  }
  if (padroes.gastoMedioDiasBaixos !== null && padroes.gastoMedioDiasBons !== null) {
    itens.push({
      icone: <Wallet className="size-5 text-muted" />,
      texto: `Nos dias de nota baixa, o gasto médio foi ${reais(padroes.gastoMedioDiasBaixos)}. Nos dias bons, ${reais(padroes.gastoMedioDiasBons)}.`,
    });
  }
  if (padroes.noite.total >= 2) {
    itens.push({
      icone: <Moon className="size-5 text-muted" />,
      texto: `Depois das 21h foram ${padroes.noite.total} compras, e ${padroes.noite.naoNecessarias} delas não eram necessárias.`,
    });
  }
  if (!itens.length) return <p className="text-[0.92rem] text-muted">Registre mais compras para aparecerem os padrões.</p>;
  return (
    <ul>
      {itens.map((i) => (
        <li key={i.texto} className="flex items-start gap-3 border-b border-line py-2.5 last:border-0">
          <span aria-hidden="true" className="mt-0.5 grid w-7 shrink-0 place-items-center">
            {i.icone}
          </span>
          <p>{i.texto}</p>
        </li>
      ))}
    </ul>
  );
}

export { RostoSvg };
