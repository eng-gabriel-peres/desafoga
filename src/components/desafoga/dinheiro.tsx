"use client";

import { ArrowDownLeft, ArrowUpRight, Check, CreditCard, Landmark, PencilLine, Plus, Trash2, Wallet } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useAgora } from "@/hooks/use-agora";
import { useConsulta } from "@/hooks/use-consulta";
import { lerValorEmReais } from "@/lib/dinheiro";
import { reais } from "@/lib/formatar";
import { servicos, type CartaoVisto, type DinheiroDaPessoa } from "@/services";
import { Painel, Sub } from "./ui/blocos";
import { Botao } from "./ui/botao";
import { CAMPO, CampoReais } from "./ui/campos";

const hojeNoBrasil = (agora: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(agora);
/** "05/12" a partir de "YYYY-MM-DD". */
const diaCurto = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
const nomeDoMes = (agora: Date, n: number) => {
  const d = new Date(agora.getFullYear(), agora.getMonth() + n, 1);
  return d.toLocaleDateString("pt-BR", { month: "long" });
};

/** Saldo de hoje, quanto sobra até o fim do mês e a previsão do mês que vem. */
export function ResumoDoDinheiro({ d, agora, comLink }: { d: DinheiroDaPessoa; agora: Date; comLink?: boolean }) {
  if (d.saldo === null || !d.previsao) {
    return (
      <p className="text-muted">
        Informe quanto tem na conta hoje para o app mostrar quanto sobra até o fim do mês e no mês que vem.{" "}
        {comLink && (
          <Link href="/app/contas" className="font-bold text-primary">
            Informar em Contas
          </Link>
        )}
      </p>
    );
  }
  const p = d.previsao;
  const linha = (rotulo: string, valor: number, detalhe?: string) => (
    <div className="rounded-2xl bg-surface2 p-3">
      <span className="block text-[0.85rem] text-muted">{rotulo}</span>
      <b className={`text-[1.3rem] ${valor < 0 ? "text-bad" : ""}`}>{reais(valor)}</b>
      {detalhe && <span className="block text-[0.8rem] text-muted">{detalhe}</span>}
    </div>
  );
  return (
    <div className="grid grid-cols-1 gap-2 desk:grid-cols-3">
      {linha(d.conectado ? "Na conta (pelo banco)" : "Na conta hoje", p.saldo)}
      {linha(
        `Sobra no fim de ${nomeDoMes(agora, 0)}`,
        p.fimDoMes,
        [p.rendaQueAindaEntra ? `+ renda ${reais(p.rendaQueAindaEntra)}` : "", p.faturasDesteMes ? `− faturas ${reais(p.faturasDesteMes)}` : ""].filter(Boolean).join(" · ") || "depois das contas que faltam",
      )}
      {linha(`Previsão para ${nomeDoMes(agora, 1)}`, p.mesQueVem, p.faturaDoMesQueVem ? `com a fatura de ${reais(p.faturaDoMesQueVem)}` : "renda − contas e parcelas")}
    </div>
  );
}

/** Seu dinheiro em Contas: resumo, minha conta, cartões e faturas. */
export function PainelDoDinheiro({ pessoaId, somenteLeitura }: { pessoaId: string; somenteLeitura: boolean }) {
  const d = useConsulta(`dinheiro:${pessoaId}`, () => servicos.dinheiro.ver(pessoaId));
  const agora = useAgora();
  if (!d || !agora || !d.compartilhado) return null;
  return (
    <>
      <Painel titulo="Seu dinheiro">
        <ResumoDoDinheiro d={d} agora={agora} />
        <Sub className="mt-2.5">
          Débito e Pix saem da conta na hora; no cartão, a compra cai na fatura que vence depois do fechamento, como no banco.
        </Sub>
      </Painel>
      {!d.conectado && <MinhaConta pessoaId={pessoaId} d={d} agora={agora} somenteLeitura={somenteLeitura} />}
      <Faturas pessoaId={pessoaId} d={d} somenteLeitura={somenteLeitura} />
      <MeusCartoes pessoaId={pessoaId} cartoes={d.cartoes} somenteLeitura={somenteLeitura} />
    </>
  );
}

function MinhaConta({ pessoaId, d, agora, somenteLeitura }: { pessoaId: string; d: DinheiroDaPessoa; agora: Date; somenteLeitura: boolean }) {
  const [editandoSaldo, setEditandoSaldo] = useState(d.saldo === null);
  const [saldoTexto, setSaldoTexto] = useState("");
  const [lancando, setLancando] = useState<"entrada" | "saida" | null>(null);
  const [valor, setValor] = useState("");
  const [descricao, setDescricao] = useState("");
  const [dia, setDia] = useState(hojeNoBrasil(agora));
  const [erro, setErro] = useState("");

  async function salvarSaldo(e: React.FormEvent) {
    e.preventDefault();
    const v = lerValorEmReais(saldoTexto);
    if (v === null) return setErro("Escreva quanto tem na conta, por exemplo: 1.250,00");
    setErro("");
    await servicos.dinheiro.informarSaldo(pessoaId, v);
    setEditandoSaldo(false);
    setSaldoTexto("");
  }

  async function lancar(e: React.FormEvent) {
    e.preventDefault();
    const v = lerValorEmReais(valor);
    if (!v) return setErro("Escreva o valor.");
    if (!descricao.trim()) return setErro("Escreva o que foi (ex.: Pix do irmão, saque).");
    setErro("");
    await servicos.dinheiro.lancar(pessoaId, { valor: lancando === "saida" ? -v : v, descricao: descricao.trim(), dia });
    setLancando(null);
    setValor("");
    setDescricao("");
  }

  return (
    <Painel titulo="Minha conta" acao={!somenteLeitura && d.saldo !== null && !editandoSaldo ? <Botao variante="link" tamanho="pequeno" onClick={() => setEditandoSaldo(true)}><PencilLine aria-hidden="true" />Atualizar saldo</Botao> : undefined}>
      {!somenteLeitura && editandoSaldo ? (
        <form onSubmit={salvarSaldo} noValidate className="grid gap-2.5">
          <Sub>Sem banco conectado, o app acompanha a conta a partir do que você tem hoje: a renda entra no dia dela, e o que você paga sai.</Sub>
          <CampoReais rotulo="Quanto você tem na conta hoje?" value={saldoTexto} onChange={(e) => setSaldoTexto(e.target.value)} />
          <div className="flex gap-2">
            <Botao type="submit" tamanho="pequeno">
              <Check aria-hidden="true" /> Salvar
            </Botao>
            {d.saldo !== null && (
              <Botao variante="secundario" tamanho="pequeno" onClick={() => setEditandoSaldo(false)}>
                Cancelar
              </Botao>
            )}
          </div>
        </form>
      ) : d.saldo === null ? (
        <Sub>{somenteLeitura ? "A pessoa ainda não informou o saldo." : ""}</Sub>
      ) : (
        <>
          <p className="flex items-center gap-2">
            <Wallet aria-hidden="true" className="size-5 text-primary" /> Saldo hoje: <b className={d.saldo < 0 ? "text-bad" : ""}>{reais(d.saldo)}</b>
          </p>
          {d.desde && <Sub className="mt-0.5">Contando a partir do saldo informado em {diaCurto(d.desde)}.</Sub>}
          {!somenteLeitura && (
            <div className="mt-2.5 flex flex-wrap gap-2">
              <Botao variante="secundario" tamanho="pequeno" onClick={() => setLancando("entrada")}>
                <ArrowDownLeft aria-hidden="true" /> Entrou dinheiro
              </Botao>
              <Botao variante="secundario" tamanho="pequeno" onClick={() => setLancando("saida")}>
                <ArrowUpRight aria-hidden="true" /> Saiu dinheiro
              </Botao>
            </div>
          )}
          {lancando && (
            <form onSubmit={lancar} noValidate className="mt-3 grid gap-2.5 rounded-2xl border border-line p-3">
              <b>{lancando === "entrada" ? "Entrou na conta" : "Saiu da conta"}</b>
              <CampoReais rotulo="Valor" value={valor} onChange={(e) => setValor(e.target.value)} />
              <label>
                <span className="mb-1 block font-bold">O que foi</span>
                <input value={descricao} onChange={(e) => setDescricao(e.target.value)} maxLength={80} placeholder={lancando === "entrada" ? "Ex.: Pix do irmão, bico" : "Ex.: saque, transferência"} className={CAMPO} />
              </label>
              <label>
                <span className="mb-1 block font-bold">Dia</span>
                <input type="date" value={dia} max={hojeNoBrasil(agora)} onChange={(e) => setDia(e.target.value)} className={CAMPO} />
              </label>
              <div className="flex gap-2">
                <Botao type="submit" tamanho="pequeno">
                  <Check aria-hidden="true" /> Salvar
                </Botao>
                <Botao variante="secundario" tamanho="pequeno" onClick={() => setLancando(null)}>
                  Cancelar
                </Botao>
              </div>
            </form>
          )}
          {d.extrato.length > 0 && (
            <ul className="mt-3">
              {d.extrato.slice(0, 10).map((m, i) => (
                <li key={m.id ?? `${m.dia}-${i}`} className="flex items-center gap-2.5 border-b border-line py-2 last:border-0">
                  <span className="w-11 text-[0.85rem] text-muted">{diaCurto(m.dia)}</span>
                  <span className="min-w-0 flex-1 truncate">{m.descricao}</span>
                  <b className={m.valor >= 0 ? "text-good" : ""}>
                    {m.valor >= 0 ? "+ " : "− "}
                    {reais(Math.abs(m.valor))}
                  </b>
                  {m.id && !somenteLeitura && (
                    <button type="button" aria-label={`Apagar ${m.descricao}`} onClick={() => servicos.dinheiro.apagarLancamento(pessoaId, m.id!)} className="grid size-8 place-items-center rounded-full text-muted hover:bg-surface2 hover:text-bad">
                      <Trash2 aria-hidden="true" className="size-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {erro && (
        <p role="alert" className="mt-2 font-bold text-bad">
          {erro}
        </p>
      )}
    </Painel>
  );
}

function Faturas({ pessoaId, d, somenteLeitura }: { pessoaId: string; d: DinheiroDaPessoa; somenteLeitura: boolean }) {
  if (!d.faturas.length) return null;
  return (
    <Painel titulo="Faturas dos cartões">
      <ul>
        {d.faturas.slice(0, 8).map((f) => (
          <li key={`${f.cartaoId}-${f.vence}`} className="flex items-center gap-2.5 border-b border-line py-2.5 last:border-0">
            <CreditCard aria-hidden="true" className="size-5 shrink-0 text-muted" />
            <span className="min-w-0 flex-1">
              <b className="block truncate">{f.cartao}</b>
              <span className="text-[0.85rem] text-muted">
                {f.fecha ? `fecha ${diaCurto(f.fecha)} · ` : ""}vence {diaCurto(f.vence)}
                {f.origem === "banco" ? " · pelo banco" : ""}
              </span>
            </span>
            <b>{reais(f.valor)}</b>
            {!somenteLeitura && (
              <Botao variante="secundario" tamanho="pequeno" onClick={() => servicos.dinheiro.pagarFatura(pessoaId, f.cartaoId, f.vence, f.valor)}>
                <Check aria-hidden="true" /> Paguei
              </Botao>
            )}
          </li>
        ))}
      </ul>
    </Painel>
  );
}

function MeusCartoes({ pessoaId, cartoes, somenteLeitura }: { pessoaId: string; cartoes: CartaoVisto[]; somenteLeitura: boolean }) {
  const [editando, setEditando] = useState<CartaoVisto | "novo" | null>(null);
  if (somenteLeitura && !cartoes.length) return null;
  return (
    <Painel
      titulo="Meus cartões"
      acao={
        !somenteLeitura && (
          <Botao variante="secundario" tamanho="pequeno" onClick={() => setEditando("novo")}>
            <Plus aria-hidden="true" /> Cartão
          </Botao>
        )
      }
    >
      {cartoes.length ? (
        <ul>
          {cartoes.map((c) => (
            <li key={c.id} className="flex items-center gap-2.5 border-b border-line py-2.5 last:border-0">
              {c.origem === "banco" ? <Landmark aria-hidden="true" className="size-5 text-muted" /> : <CreditCard aria-hidden="true" className="size-5 text-muted" />}
              <span className="min-w-0 flex-1">
                <b className="block truncate">{c.nome}</b>
                <span className="text-[0.85rem] text-muted">
                  Fecha dia {c.fechamento}, vence dia {c.vencimento}
                  {c.limite ? ` · limite ${reais(c.limite)}` : ""}
                  {c.origem === "banco" ? " · do banco" : ""}
                </span>
              </span>
              {!somenteLeitura && c.origem === "manual" && (
                <Botao variante="link" tamanho="pequeno" onClick={() => setEditando(c)}>
                  Editar
                </Botao>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <Sub>Cadastre o cartão com o dia em que a fatura fecha e o dia em que vence. Assim cada compra cai na fatura certa.</Sub>
      )}
      {editando && <FormularioDoCartao key={editando === "novo" ? "novo" : editando.id} pessoaId={pessoaId} cartao={editando === "novo" ? null : editando} fechar={() => setEditando(null)} />}
    </Painel>
  );
}

function FormularioDoCartao({ pessoaId, cartao, fechar }: { pessoaId: string; cartao: CartaoVisto | null; fechar: () => void }) {
  const [nome, setNome] = useState(cartao?.nome ?? "");
  const [fechamento, setFechamento] = useState(String(cartao?.fechamento ?? ""));
  const [vencimento, setVencimento] = useState(String(cartao?.vencimento ?? ""));
  const [limite, setLimite] = useState(cartao?.limite ? String(cartao.limite / 100).replace(".", ",") : "");
  const [erro, setErro] = useState("");

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const f = Number.parseInt(fechamento, 10);
    const v = Number.parseInt(vencimento, 10);
    if (!nome.trim()) return setErro("Dê um nome ao cartão (ex.: Nubank).");
    if (!(f >= 1 && f <= 31) || !(v >= 1 && v <= 31)) return setErro("Os dias vão de 1 a 31. Estão na fatura ou no app do cartão.");
    setErro("");
    try {
      await servicos.dinheiro.salvarCartao(pessoaId, { ...(cartao ? { id: cartao.id } : {}), nome: nome.trim(), fechamento: f, vencimento: v, limite: lerValorEmReais(limite) || null });
      fechar();
    } catch (x) {
      setErro(x instanceof Error ? x.message : "Não deu para salvar.");
    }
  }

  return (
    <form onSubmit={salvar} noValidate className="mt-3 grid gap-2.5 rounded-2xl border border-line p-3">
      <label>
        <span className="mb-1 block font-bold">Nome do cartão</span>
        <input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={40} placeholder="Ex.: Nubank" className={CAMPO} />
      </label>
      <div className="grid grid-cols-2 gap-2.5">
        <label>
          <span className="mb-1 block font-bold">Fecha dia</span>
          <input value={fechamento} onChange={(e) => setFechamento(e.target.value.replace(/\D/g, "").slice(0, 2))} inputMode="numeric" placeholder="25" className={CAMPO} />
        </label>
        <label>
          <span className="mb-1 block font-bold">Vence dia</span>
          <input value={vencimento} onChange={(e) => setVencimento(e.target.value.replace(/\D/g, "").slice(0, 2))} inputMode="numeric" placeholder="5" className={CAMPO} />
        </label>
      </div>
      <CampoReais rotulo="Limite (opcional)" value={limite} onChange={(e) => setLimite(e.target.value)} />
      {erro && (
        <p role="alert" className="font-bold text-bad">
          {erro}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Botao type="submit" tamanho="pequeno">
          <Check aria-hidden="true" /> Salvar
        </Botao>
        <Botao variante="secundario" tamanho="pequeno" onClick={fechar}>
          Cancelar
        </Botao>
        {cartao && (
          <Botao
            variante="link"
            tamanho="pequeno"
            className="text-bad!"
            onClick={async () => {
              await servicos.dinheiro.removerCartao(pessoaId, cartao.id);
              fechar();
            }}
          >
            <Trash2 aria-hidden="true" /> Apagar cartão
          </Botao>
        )}
      </div>
    </form>
  );
}
