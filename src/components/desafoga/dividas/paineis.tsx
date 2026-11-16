/** Painéis da tela de dívidas. Os números vêm de `lib/finance`. */
import { Banknote, Brain, CreditCard, FileText, Landmark, Percent, Receipt, ScanLine, Upload, Wallet, type LucideIcon } from "lucide-react";
import {
  dividaMaisCara,
  ehEncargo,
  jurosDoMes,
  type CustoEmocional,
  type Divida,
  type Encargos,
  type Fatura,
  type TipoDivida,
} from "@/lib/finance";
import { percentual } from "@/lib/assistente/textos";
import { reais } from "@/lib/formatar";
import { Etiqueta, Painel, Sub, Vazio } from "../ui/blocos";
import { BotaoLink } from "../ui/botao";

const ICONE_DA_DIVIDA: Record<TipoDivida, LucideIcon> = {
  cartao: CreditCard,
  cheque: Landmark,
  emprestimo: Banknote,
  parcelamento: Receipt,
  outra: Wallet,
};

/** Raio-x do mês: juros, IOF e tarifas, e quanto custa ficar só no mínimo. */
export function RaioX({
  encargos,
  estimativa,
  jurosEm12Meses,
  sujeito,
}: {
  encargos: Encargos;
  /** Juros estimados pelas taxas quando não há fatura lida. */
  estimativa: number;
  jurosEm12Meses: number;
  /** "você pagou" ou "Ana pagou". */
  sujeito: string;
}) {
  const temFatura = encargos.total > 0;
  return (
    <section
      aria-label="Raio-x dos juros"
      className="rounded-[var(--radius-card)] border-2 border-bad/40 bg-surface p-[1.1rem]"
      style={{ background: "linear-gradient(135deg, var(--bad-soft), var(--surface) 70%)" }}
    >
      <p className="flex items-center gap-2 font-bold text-bad">
        <ScanLine aria-hidden="true" className="size-5" />
        Raio-x dos juros
      </p>
      <p className="mt-2 text-[1.25rem] leading-snug">
        Este mês {sujeito} <b className="text-[1.5rem]">{reais(temFatura ? encargos.total : estimativa)}</b>{" "}
        {temFatura ? "em juros, IOF e tarifas." : "de juros (estimativa pelas taxas)."}
      </p>
      <p className="mt-2 text-muted">
        Pagando só o mínimo, serão cerca de <b className="text-ink">{reais(jurosEm12Meses)}</b> de juros nos próximos 12 meses.
      </p>
      {temFatura && (
        <ul className="mt-3 flex flex-wrap gap-2 text-[0.9rem]">
          <li className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1">
            <Percent aria-hidden="true" className="size-3.5" />
            Juros {reais(encargos.juros)}
          </li>
          <li className="rounded-full border border-line bg-surface px-3 py-1">IOF {reais(encargos.iof)}</li>
          <li className="rounded-full border border-line bg-surface px-3 py-1">Tarifas {reais(encargos.tarifas)}</li>
        </ul>
      )}
    </section>
  );
}

export function ListaDeDividas({ dividas, titulo }: { dividas: Divida[]; titulo: string }) {
  const maisCara = dividaMaisCara(dividas);
  return (
    <Painel titulo={titulo}>
      {dividas.length ? (
        <ul>
          {dividas.map((d) => {
            const Icone = ICONE_DA_DIVIDA[d.tipo];
            const destaque = d.id === maisCara?.id;
            return (
              <li key={d.id} className="grid grid-cols-[auto_1fr_auto] gap-x-3 gap-y-1.5 border-b border-line py-3 last:border-0">
                <span aria-hidden="true" className="grid size-11 place-items-center rounded-xl bg-primary-soft text-primary">
                  <Icone className="size-5" />
                </span>
                <div className="min-w-0">
                  <b className="block">{d.nome}</b>
                  <span className="text-[0.88rem] text-muted">
                    {d.detalhe}, vence dia {d.vencimento}
                  </span>
                </div>
                <div className="text-right">
                  <b className="block">{reais(d.saldo)}</b>
                  <span className="text-[0.88rem] text-muted">mín. {reais(d.parcelaMinima)}</span>
                </div>
                <div className="col-span-2 col-start-2 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                  <Etiqueta tom={destaque ? "ruim" : "neutra"}>
                    {percentual(d.taxaMensal)} ao mês{destaque ? ", a mais cara" : ""}
                  </Etiqueta>
                  <span className="text-[0.88rem] text-muted">Juros: {reais(jurosDoMes(d))} por mês</span>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <Vazio>Nenhuma dívida cadastrada.</Vazio>
      )}
    </Painel>
  );
}

/** Quanto dos juros veio de compras feitas com emoção 1 ou 2. */
export function PainelCustoEmocional({ custo, sujeito }: { custo: CustoEmocional; sujeito: string }) {
  const parte = Math.round(custo.parteTriste * 100);
  return (
    <Painel titulo="Custo emocional" acao={<Brain aria-hidden="true" className="size-5 text-muted" />}>
      <p>
        Cerca de <b>{reais(custo.custoTriste)}</b> dos juros do cartão vêm de compras feitas quando {sujeito} triste ou muito triste.
      </p>
      <div aria-hidden="true" className="my-2.5 flex h-[22px] overflow-hidden rounded-full bg-line">
        <div className="bg-e1" style={{ width: `${parte}%` }} />
      </div>
      <Sub>
        {parte}% do valor das compras da fatura foi feito com nota 1 ou 2. As compras não necessárias respondem por{" "}
        {reais(custo.custoNaoNecessaria)} dos juros. Estimativa proporcional ao valor das compras.
      </Sub>
    </Painel>
  );
}

export function PainelFaturas({ faturas, podeEnviar }: { faturas: Fatura[]; podeEnviar: boolean }) {
  return (
    <Painel
      titulo="Faturas e extratos"
      acao={
        podeEnviar && (
          <BotaoLink href="/app/dividas/fatura" tamanho="pequeno">
            <Upload aria-hidden="true" />
            Enviar
          </BotaoLink>
        )
      }
    >
      {faturas.length ? (
        <ul>
          {faturas.map((f) => {
            const encargos = f.lancamentos.filter(ehEncargo).reduce((s, l) => s + l.valor, 0);
            return (
              <li key={f.id} className="flex items-center gap-3 border-b border-line py-3 last:border-0">
                <FileText aria-hidden="true" className="size-5 shrink-0 text-muted" />
                <span className="min-w-0 flex-1">
                  <b className="block">{f.origem}</b>
                  <span className="text-[0.88rem] text-muted">
                    {f.lancamentos.length} lançamentos, {reais(encargos)} em juros e tarifas
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <Sub>Nenhuma fatura enviada ainda.</Sub>
      )}
      {podeEnviar && <Sub className="mt-2">Também dá para mandar a foto ou o PDF para a Luana pelo WhatsApp.</Sub>}
    </Painel>
  );
}
