"use client";

import {
  BusFront,
  CalendarCheck,
  Check,
  Droplet,
  GraduationCap,
  HeartPulse,
  House,
  PencilLine,
  Receipt,
  Trash2,
  Tv,
  Wallet,
  Wifi,
  Zap,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import {
  NOME_DA_CATEGORIA_DA_CONTA,
  type CategoriaDaConta,
  type Compromisso,
  type ContaFixa,
  type TotaisDoMes,
} from "@/lib/finance";
import { reais } from "@/lib/formatar";
import { lerValorEmReais } from "@/lib/dinheiro";
import { servicos, type Renda } from "@/services";
import { Painel, Sub } from "./ui/blocos";
import { Botao } from "./ui/botao";
import { Barra, CAMPO, CampoReais } from "./ui/campos";

export const ICONE_DA_CONTA: Record<CategoriaDaConta, LucideIcon> = {
  moradia: House,
  luz: Zap,
  agua: Droplet,
  internet: Wifi,
  transporte: BusFront,
  saude: HeartPulse,
  educacao: GraduationCap,
  assinatura: Tv,
  outra: Receipt,
};

/** Nome curto na grade do formulário. */
const NOME_CURTO: Record<CategoriaDaConta, string> = { ...NOME_DA_CATEGORIA_DA_CONTA, internet: "Internet" };
const CATEGORIAS = Object.keys(ICONE_DA_CONTA) as CategoriaDaConta[];

const valorDe = (c: Compromisso) => `${c.estimado ? "~ " : ""}${reais(c.valor)}`;
const emTexto = (centavos: number) => (centavos ? (centavos / 100).toFixed(2).replace(".", ",").replace(/,00$/, "") : "");
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** Situação da conta em palavras: "Vence em 2 dias", "Venceu há 3 dias"… */
export function situacaoDaConta(c: Compromisso, hoje: number): string {
  if (c.pago) return c.automatico ? "Débito automático" : "Pago";
  if (c.vencida) return `Venceu há ${plural(hoje - c.dia, "dia", "dias")}`;
  if (c.dia === hoje) return "Vence hoje";
  if (c.emBreve) return `Vence em ${plural(c.dia - hoje, "dia", "dias")}`;
  return `Vence dia ${c.dia}`;
}

/** Cartão da tela Hoje: as próximas três contas e quanto sobra da renda. */
export function ProximasContas({ compromissos, totais, agora }: { compromissos: Compromisso[]; totais: TotaisDoMes; agora: Date }) {
  const proximas = compromissos.filter((c) => !c.pago).slice(0, 3);
  if (!compromissos.length) {
    return (
      <Painel
        titulo="Contas do mês"
        acao={
          <Link href="/app/contas" className="text-[0.92rem] font-bold text-primary">
            Adicionar
          </Link>
        }
      >
        <Sub>Cadastre aluguel, luz, água e o que você paga todo mês. Eu mostro o que vence e quanto sobra.</Sub>
      </Painel>
    );
  }
  return (
    <Painel
      titulo="Próximas contas"
      acao={
        <Link href="/app/contas" className="text-[0.92rem] font-bold text-primary">
          Ver todas
        </Link>
      }
    >
      {proximas.length ? (
        <ul>
          {proximas.map((c) => (
            <li key={`${c.tipo}-${c.id}`} className="flex items-center gap-3 border-b border-line py-2 last:border-0">
              <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-surface2 text-[0.95rem] font-bold">{c.dia}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate">{c.nome}</span>
                <span className={`text-[0.82rem] ${c.vencida ? "font-bold text-bad" : "text-muted"}`}>{situacaoDaConta(c, agora.getDate())}</span>
              </span>
              <b className="whitespace-nowrap">{valorDe(c)}</b>
            </li>
          ))}
        </ul>
      ) : (
        <p className="flex items-center gap-2 font-bold text-good">
          <Check aria-hidden="true" className="size-5" />
          Tudo pago neste mês.
        </p>
      )}
      {totais.sobra !== null && (
        <Sub className="mt-2">
          Depois das contas e parcelas, sobram <b className={totais.sobra < 0 ? "text-bad" : "text-good"}>{reais(totais.sobra)}</b> este mês.
        </Sub>
      )}
    </Painel>
  );
}

/** Resumo do mês: quanto somam os compromissos, quanto já foi pago e quanto sobra da renda. */
export function ResumoDasContas({
  pessoaId,
  totais,
  renda,
  agora,
  somenteLeitura,
}: {
  pessoaId: string;
  totais: TotaisDoMes;
  renda: Renda | null;
  agora: Date;
  somenteLeitura: boolean;
}) {
  const [editando, setEditando] = useState(false);
  const nomeDoMes = agora.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const mes = nomeDoMes.charAt(0).toUpperCase() + nomeDoMes.slice(1);
  return (
    <Painel rotulo={`Resumo de ${mes}`}>
      <p className="flex items-center gap-2 text-[0.9rem] font-bold text-muted">
        <CalendarCheck aria-hidden="true" className="size-4.5" />
        {mes}
      </p>
      <p className="mt-1.5 text-[1.15rem] leading-snug">
        {somenteLeitura ? "Os" : "Seus"} compromissos fixos do mês somam <b className="text-[1.3rem]">{reais(totais.total)}</b>.
      </p>
      <div className="mt-3">
        <Barra fracao={totais.fracaoPaga} tom="boa" />
      </div>
      <div className="mt-1.5 flex justify-between text-[0.92rem]">
        <span>
          <b className="text-good">{reais(totais.pago)}</b> pagos
        </span>
        <span>
          <b>{reais(totais.falta)}</b> falta pagar
        </span>
      </div>
      <dl className="mt-3.5 grid grid-cols-3 gap-2 rounded-2xl bg-surface2 p-3 text-[0.85rem]">
        <div>
          <dt className="text-muted">Contas fixas</dt>
          <dd className="font-bold">{reais(totais.contas)}</dd>
        </div>
        <div>
          <dt className="text-muted">Parcelas de dívidas</dt>
          <dd className="font-bold">{reais(totais.parcelas)}</dd>
        </div>
        <div>
          <dt className="text-muted">{totais.renda ? "Sobra da renda" : "Renda"}</dt>
          <dd className={`font-bold ${totais.sobra === null ? "" : totais.sobra < 0 ? "text-bad" : "text-good"}`}>
            {totais.sobra === null ? "Não informada" : reais(totais.sobra)}
          </dd>
        </div>
      </dl>
      {totais.sobra !== null && totais.sobra < 0 && (
        <p className="mt-2.5 rounded-xl bg-bad-soft px-3 py-2 text-[0.92rem] text-bad">
          Os compromissos passam da renda em {reais(-totais.sobra)}. Vale conversar com quem te acompanha sobre o que dá para renegociar.
        </p>
      )}
      {somenteLeitura ? (
        renda && <Sub className="mt-2.5">Renda informada: {reais(renda.valor)} por mês, recebe dia {renda.dia}.</Sub>
      ) : editando ? (
        <EditorDeRenda pessoaId={pessoaId} renda={renda} fechar={() => setEditando(false)} />
      ) : (
        <Botao variante="link" tamanho="pequeno" className="mt-1.5" onClick={() => setEditando(true)}>
          <PencilLine aria-hidden="true" />
          {renda ? `Renda: ${reais(renda.valor)}, dia ${renda.dia}. Alterar` : "Informar quanto entra por mês"}
        </Botao>
      )}
    </Painel>
  );
}

function EditorDeRenda({ pessoaId, renda, fechar }: { pessoaId: string; renda: Renda | null; fechar: () => void }) {
  const [valor, setValor] = useState(emTexto(renda?.valor ?? 0));
  const [dia, setDia] = useState(String(renda?.dia ?? 5));
  const [erro, setErro] = useState("");
  async function salvar() {
    const v = lerValorEmReais(valor);
    const d = Number(dia);
    if (valor.trim() && !v) return setErro("Escreva quanto entra por mês, por exemplo: 2800");
    if (!(d >= 1 && d <= 31)) return setErro("O dia vai de 1 a 31.");
    await servicos.contas.salvarRenda(pessoaId, v ? { valor: v, dia: d } : null);
    fechar();
  }
  return (
    <div className="mt-3 border-t border-line pt-3">
      <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-2.5">
        <CampoReais rotulo="Quanto entra por mês" value={valor} onChange={(e) => setValor(e.target.value)} autoFocus />
        <label>
          <span className="mb-1 block font-bold">Dia que recebe</span>
          <input className={CAMPO} inputMode="numeric" value={dia} onChange={(e) => setDia(e.target.value)} />
        </label>
      </div>
      {erro && (
        <p role="alert" className="mt-2 font-bold text-bad">
          {erro}
        </p>
      )}
      <div className="mt-2.5 grid grid-cols-2 gap-2.5">
        <Botao variante="secundario" tamanho="pequeno" onClick={fechar}>
          Cancelar
        </Botao>
        <Botao tamanho="pequeno" onClick={salvar}>
          Salvar
        </Botao>
      </div>
    </div>
  );
}

/** Uma conta ou parcela na lista de vencimentos, com "Paguei" e "Desfazer". */
export function LinhaDeVencimento({
  pessoaId,
  c,
  agora,
  somenteLeitura,
  editar,
}: {
  pessoaId: string;
  c: Compromisso;
  agora: Date;
  somenteLeitura: boolean;
  editar?: () => void;
}) {
  const [perguntando, setPerguntando] = useState(false);
  const [valor, setValor] = useState(emTexto(c.valor));
  const [erro, setErro] = useState("");
  const Icone = c.tipo === "divida" ? Wallet : ICONE_DA_CONTA[c.categoria];
  const diaDaSemana = new Date(agora.getFullYear(), agora.getMonth(), c.dia).toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");

  async function pagar(v: number | null) {
    setErro("");
    try {
      await servicos.contas.pagar(pessoaId, c.tipo, c.id, v);
      setPerguntando(false);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não consegui salvar.");
    }
  }

  return (
    <li className={`border-b border-line py-3 last:border-0 ${c.pago ? "opacity-75" : ""}`}>
      <div className="flex items-center gap-3">
        <span className="grid w-10 shrink-0 text-center leading-tight">
          <b className="text-[1.1rem]">{c.dia}</b>
          <span className="text-[0.75rem] text-muted capitalize">{diaDaSemana}</span>
        </span>
        <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-surface2 text-muted">
          <Icone className="size-4.5" />
        </span>
        <span className="min-w-0 flex-1">
          {!somenteLeitura && editar ? (
            <button
              type="button"
              onClick={editar}
              aria-label={`${c.nome} (editar)`}
              className="group flex max-w-full items-center gap-1.5 text-left font-bold hover:text-primary"
            >
              <span className="truncate">{c.nome}</span>
              <PencilLine aria-hidden="true" className="size-3.5 shrink-0 text-muted group-hover:text-primary" />
            </button>
          ) : (
            <b className="block truncate">{c.nome}</b>
          )}
          <span className={`flex items-center gap-1 text-[0.85rem] ${c.vencida ? "font-bold text-bad" : "text-muted"}`}>
            {c.pago && <Check aria-hidden="true" className="size-3.5 text-good" />}
            {situacaoDaConta(c, agora.getDate())}
            {c.tipo === "divida" ? ", parcela de dívida" : ""}
          </span>
        </span>
        <span className="flex w-[7.5rem] shrink-0 flex-col items-end gap-1">
          <b className="whitespace-nowrap">{valorDe(c)}</b>
          {!somenteLeitura &&
            (c.pago ? (
              !c.automatico && (
                <button type="button" onClick={() => servicos.contas.desfazer(pessoaId, c.tipo, c.id)} className="text-[0.82rem] font-bold text-primary">
                  Desfazer
                </button>
              )
            ) : (
              <Botao
                variante="secundario"
                tamanho="pequeno"
                className="min-h-9! px-3!"
                aria-label={`Paguei ${c.nome}`}
                onClick={() => (c.estimado ? setPerguntando(true) : pagar(c.tipo === "divida" ? c.valor : null))}
              >
                <Check aria-hidden="true" />
                Paguei
              </Botao>
            ))}
        </span>
      </div>
      {perguntando && (
        <div className="mt-2.5 rounded-2xl bg-surface2 p-3">
          <CampoReais rotulo="Quanto veio este mês?" value={valor} onChange={(e) => setValor(e.target.value)} autoFocus />
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Botao variante="secundario" tamanho="pequeno" onClick={() => setPerguntando(false)}>
              Cancelar
            </Botao>
            <Botao
              tamanho="pequeno"
              onClick={() => {
                const v = lerValorEmReais(valor);
                if (!v) return setErro("Escreva o valor que veio este mês.");
                void pagar(v);
              }}
            >
              Confirmar
            </Botao>
          </div>
        </div>
      )}
      {erro && (
        <p role="alert" className="mt-1.5 text-[0.9rem] font-bold text-bad">
          {erro}
        </p>
      )}
    </li>
  );
}

/** Calendário do mês: cada dia com contas mostra o total e a cor da situação. */
export function CalendarioDoMes({
  compromissos,
  agora,
  dia,
  escolher,
}: {
  compromissos: Compromisso[];
  agora: Date;
  dia: number | null;
  escolher: (dia: number | null) => void;
}) {
  const ultimo = new Date(agora.getFullYear(), agora.getMonth() + 1, 0).getDate();
  const primeiro = new Date(agora.getFullYear(), agora.getMonth(), 1).getDay();
  const hoje = agora.getDate();
  const curto = (v: number) => (v >= 100000 ? `R$${(v / 100000).toFixed(1).replace(".", ",")}k` : `R$${Math.round(v / 100)}`);
  return (
    <Painel
      titulo="Calendário do mês"
      acao={
        dia !== null && (
          <button type="button" onClick={() => escolher(null)} className="text-[0.92rem] font-bold text-primary">
            Ver todas
          </button>
        )
      }
    >
      <div aria-hidden="true" className="mb-1 grid grid-cols-7 text-center text-[0.8rem] font-bold text-muted">
        {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: primeiro }, (_, i) => (
          <span key={`v${i}`} />
        ))}
        {Array.from({ length: ultimo }, (_, i) => {
          const d = i + 1;
          const itens = compromissos.filter((c) => c.dia === d);
          const total = itens.reduce((s, c) => s + c.valor, 0);
          const estado = !itens.length ? "" : itens.every((c) => c.pago) ? "pago" : itens.some((c) => c.vencida) ? "vencida" : "aberta";
          const cor = {
            "": "border-transparent text-muted",
            pago: "border-good/40 bg-good-soft",
            vencida: "border-bad/40 bg-bad-soft",
            aberta: "border-primary/40 bg-primary-soft",
          }[estado];
          return (
            <button
              key={d}
              type="button"
              disabled={!itens.length}
              aria-pressed={dia === d}
              aria-label={`Dia ${d}${itens.length ? `: ${plural(itens.length, "conta", "contas")}, ${reais(total)}` : ""}`}
              onClick={() => escolher(dia === d ? null : d)}
              className={`flex min-h-12 flex-col items-center justify-center rounded-[10px] border text-[0.82rem] leading-tight aria-pressed:ring-2 aria-pressed:ring-primary ${cor} ${
                d === hoje ? "font-bold outline-2 outline-ink outline-offset-[-2px]" : ""
              }`}
            >
              <span>{d}</span>
              {itens.length > 0 && <span className="text-[0.68rem] font-bold">{curto(total)}</span>}
            </button>
          );
        })}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-3.5 text-[0.82rem] text-muted">
        <span className="flex items-center gap-1.5">
          <i className="size-3 rounded-sm bg-good-soft ring-1 ring-good/50" />
          Pago
        </span>
        <span className="flex items-center gap-1.5">
          <i className="size-3 rounded-sm bg-primary-soft ring-1 ring-primary/50" />A pagar
        </span>
        <span className="flex items-center gap-1.5">
          <i className="size-3 rounded-sm bg-bad-soft ring-1 ring-bad/50" />
          Vencida
        </span>
      </div>
    </Painel>
  );
}

/** "Para onde vão as contas fixas": total por categoria. */
export function ContasPorCategoria({ grupos }: { grupos: { categoria: CategoriaDaConta; valor: number }[] }) {
  if (!grupos.length) return null;
  const maior = grupos[0].valor;
  return (
    <Painel titulo="Para onde vão as contas fixas">
      <ul className="grid gap-2.5">
        {grupos.map(({ categoria, valor }) => {
          const Icone = ICONE_DA_CONTA[categoria];
          return (
            <li key={categoria} className="grid grid-cols-[auto_8rem_minmax(0,1fr)_auto] items-center gap-2.5 text-[0.92rem]">
              <Icone aria-hidden="true" className="size-4.5 text-muted" />
              <span className="truncate">{NOME_DA_CATEGORIA_DA_CONTA[categoria]}</span>
              <Barra fracao={valor / maior} tom="primaria" />
              <b className="text-right">{reais(valor)}</b>
            </li>
          );
        })}
      </ul>
      <Sub className="mt-2.5">Valores que mudam todo mês, como luz e água, entram pela estimativa.</Sub>
    </Painel>
  );
}

const CONTA_NOVA: Omit<ContaFixa, "id"> = { nome: "", categoria: "moradia", valor: 0, vencimento: 10, variavel: false, debitoAutomatico: false, lembrete: true };

/** Nova conta fixa ou edição de uma que já existe. */
export function FormularioDeConta({ pessoaId, conta, fechar }: { pessoaId: string; conta: ContaFixa | null; fechar: () => void }) {
  const [f, setF] = useState(conta ?? CONTA_NOVA);
  const [valor, setValor] = useState(emTexto(conta?.valor ?? 0));
  const [dia, setDia] = useState(String(f.vencimento));
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const mudar = (m: Partial<ContaFixa>) => setF((x) => ({ ...x, ...m }));

  async function salvar() {
    const v = lerValorEmReais(valor);
    const d = Number(dia);
    if (!f.nome.trim()) return setErro("Escreva o nome da conta, por exemplo: Aluguel.");
    if (!v) return setErro("Escreva o valor, por exemplo: 95,00");
    if (!(Number.isInteger(d) && d >= 1 && d <= 31)) return setErro("O vencimento é um dia de 1 a 31.");
    setSalvando(true);
    try {
      await servicos.contas.salvar(pessoaId, { ...f, nome: f.nome.trim(), valor: v, vencimento: d });
      fechar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não consegui salvar.");
      setSalvando(false);
    }
  }

  return (
    <Painel titulo={conta ? "Editar conta fixa" : "Nova conta fixa"}>
      <fieldset>
        <legend className="mb-1.5 font-bold">Tipo</legend>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {CATEGORIAS.map((c) => {
            const Icone = ICONE_DA_CONTA[c];
            return (
              <button
                key={c}
                type="button"
                aria-pressed={f.categoria === c}
                onClick={() => mudar({ categoria: c })}
                className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border-2 border-line bg-surface text-[0.8rem] font-bold hover:border-primary aria-pressed:border-primary aria-pressed:bg-primary-soft"
              >
                <Icone aria-hidden="true" className="size-5" />
                {NOME_CURTO[c]}
              </button>
            );
          })}
        </div>
      </fieldset>
      <label className="mt-3.5 block">
        <span className="mb-1 block font-bold">Nome</span>
        <input className={CAMPO} value={f.nome} onChange={(e) => mudar({ nome: e.target.value })} placeholder="Ex.: Aluguel, conta de luz" autoComplete="off" maxLength={60} />
      </label>
      <div className="mt-3.5 grid grid-cols-[minmax(0,1fr)_8rem] gap-2.5">
        <CampoReais rotulo={f.variavel ? "Valor médio" : "Valor"} value={valor} onChange={(e) => setValor(e.target.value)} />
        <label>
          <span className="mb-1 block font-bold">Vence todo dia</span>
          <input className={CAMPO} inputMode="numeric" value={dia} onChange={(e) => setDia(e.target.value)} placeholder="10" />
        </label>
      </div>
      <div className="mt-3.5 grid gap-2.5">
        {(
          [
            ["variavel", "O valor muda todo mês (como luz e água)"],
            ["debitoAutomatico", "Débito automático"],
            ["lembrete", "Lembrar no WhatsApp um dia antes"],
          ] as const
        ).map(([k, rotulo]) => (
          <label key={k} className="flex items-center gap-2.5">
            <input type="checkbox" checked={f[k]} onChange={(e) => mudar({ [k]: e.target.checked })} className="size-5 accent-[var(--primary)]" />
            {rotulo}
          </label>
        ))}
      </div>
      {erro && (
        <p role="alert" className="mt-2.5 font-bold text-bad">
          {erro}
        </p>
      )}
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <Botao variante="secundario" onClick={fechar}>
          Cancelar
        </Botao>
        <Botao onClick={salvar} disabled={salvando}>
          Salvar
        </Botao>
      </div>
      {conta && (
        <Botao
          variante="link"
          tamanho="pequeno"
          className="mt-2 text-bad!"
          onClick={async () => {
            await servicos.contas.remover(pessoaId, conta.id);
            fechar();
          }}
        >
          <Trash2 aria-hidden="true" />
          Remover esta conta
        </Botao>
      )}
    </Painel>
  );
}
