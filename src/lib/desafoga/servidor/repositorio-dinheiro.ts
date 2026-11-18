/**
 * Seu dinheiro: cartões (à mão e dos bancos conectados), o saldo da conta
 * (do banco, ou informado pela pessoa com as entradas e saídas), as faturas
 * de cada cartão no mês em que vencem e a previsão do mês. As contas usam as
 * regras puras de `finance/cartao`. Reexportado por `repositorio.ts`.
 */
import {
  compromissosDoMes,
  faturasDoCartao,
  previsaoDoDinheiro,
  saldoDaConta,
  type CartaoParaFatura,
  type Estrategia,
  type MovimentoDaConta,
  type PrevisaoDoDinheiro,
} from "@/lib/finance";
import { hojeEmBrasilia } from "@/lib/luana/lancamentos";
import { prisma } from "./prisma";
import { compras, contasFixas, dividas, NaoEncontrado, plano, renda } from "./repositorio";

export interface CartaoVisto extends CartaoParaFatura {
  limite: number | null;
  origem: "manual" | "banco";
}

export interface FaturaVista {
  cartaoId: string;
  cartao: string;
  origem: "manual" | "banco";
  fecha: string | null;
  vence: string;
  valor: number;
}

export interface DinheiroDaPessoa {
  /** false: quem vê é o profissional e a pessoa não compartilha as contas. */
  compartilhado: boolean;
  /** Tem conta corrente de banco conectado: o saldo vem do banco. */
  conectado: boolean;
  /** null: sem banco e sem saldo informado. */
  saldo: number | null;
  /** Dia do saldo informado (sem banco). */
  desde: string | null;
  /** Sem banco: entradas e saídas depois do saldo informado, do mais novo para o mais antigo. */
  extrato: (MovimentoDaConta & { id?: string })[];
  cartoes: CartaoVisto[];
  /** Faturas ainda não pagas, da que vence primeiro para a última. */
  faturas: FaturaVista[];
  previsao: PrevisaoDoDinheiro | null;
}

export const DINHEIRO_ESCONDIDO: DinheiroDaPessoa = {
  compartilhado: false,
  conectado: false,
  saldo: null,
  desde: null,
  extrato: [],
  cartoes: [],
  faturas: [],
  previsao: null,
};

const diaDaData = (data: string | null) => (data ? Number(data.slice(8, 10)) : null);

async function cartoesDoBanco(pessoaId: string) {
  return prisma().contaBancaria.findMany({ where: { tipo: "cartao", conexao: { pessoaId } }, orderBy: { nome: "asc" } });
}

/** O cartão é desta pessoa (à mão ou de banco conectado)? */
export async function cartaoDaPessoa(pessoaId: string, cartaoId: string): Promise<boolean> {
  const [manual, doBanco] = await Promise.all([
    prisma().cartao.count({ where: { id: cartaoId, pessoaId } }),
    prisma().contaBancaria.count({ where: { id: cartaoId, tipo: "cartao", conexao: { pessoaId } } }),
  ]);
  return manual + doBanco > 0;
}

export async function cartoesDaPessoa(pessoaId: string): Promise<CartaoVisto[]> {
  const [manuais, doBanco] = await Promise.all([prisma().cartao.findMany({ where: { pessoaId }, orderBy: { criadoEm: "asc" } }), cartoesDoBanco(pessoaId)]);
  return [
    ...doBanco.map((c) => ({
      id: c.id,
      nome: c.nome,
      // Sem as datas do banco ainda, um palpite comum (fecha dia 1, vence dia 8) até a próxima leitura.
      fechamento: diaDaData(c.fechamento) ?? 1,
      vencimento: diaDaData(c.vencimento) ?? 8,
      limite: c.limite,
      origem: "banco" as const,
    })),
    ...manuais.map((c) => ({ id: c.id, nome: c.nome, fechamento: c.fechamento, vencimento: c.vencimento, limite: c.limite, origem: "manual" as const })),
  ];
}

export interface NovoCartao {
  id?: string;
  nome: string;
  fechamento: number;
  vencimento: number;
  limite: number | null;
}

export async function salvarCartao(pessoaId: string, c: NovoCartao): Promise<{ id: string }> {
  const dados = { nome: c.nome, fechamento: c.fechamento, vencimento: c.vencimento, limite: c.limite };
  if (c.id) {
    const r = await prisma().cartao.updateMany({ where: { id: c.id, pessoaId }, data: dados });
    if (!r.count) throw new NaoEncontrado("Cartão não encontrado.");
    return { id: c.id };
  }
  return { id: (await prisma().cartao.create({ data: { pessoaId, ...dados } })).id };
}

/** As compras antigas desse cartão ficam registradas, mas sem cartão (saem das faturas). */
export async function removerCartao(pessoaId: string, id: string): Promise<void> {
  const r = await prisma().cartao.deleteMany({ where: { id, pessoaId } });
  if (!r.count) throw new NaoEncontrado("Cartão não encontrado.");
  await prisma().compra.updateMany({ where: { pessoaId, cartaoId: id }, data: { cartaoId: null, meio: null } });
}

/** "Hoje tenho X na conta": vale a partir de hoje (o que entrou ou saiu antes já está no valor). */
export async function informarSaldo(pessoaId: string, valor: number, agora = new Date()): Promise<void> {
  const desde = hojeEmBrasilia(agora);
  await prisma().saldoInformado.upsert({ where: { pessoaId }, create: { pessoaId, valor, desde, quando: agora }, update: { valor, desde, quando: agora } });
}

/** Entrada (valor positivo) ou saída (negativo) avulsa na conta. */
export async function lancarNaConta(pessoaId: string, l: { valor: number; descricao: string; dia: string }): Promise<{ id: string }> {
  return { id: (await prisma().lancamentoNaConta.create({ data: { pessoaId, ...l } })).id };
}

export async function apagarLancamento(pessoaId: string, id: string): Promise<void> {
  const r = await prisma().lancamentoNaConta.deleteMany({ where: { id, pessoaId } });
  if (!r.count) throw new NaoEncontrado("Lançamento não encontrado.");
}

/** Fatura paga: sai da conta e da previsão. Guardada como pagamento do mês do vencimento. */
export async function pagarFatura(pessoaId: string, cartaoId: string, vence: string, valor: number, agora = new Date()): Promise<void> {
  if (!(await cartaoDaPessoa(pessoaId, cartaoId))) throw new NaoEncontrado("Cartão não encontrado.");
  const mes = vence.slice(0, 7);
  await prisma().pagamento.upsert({
    where: { tipo_alvoId_mes: { tipo: "fatura", alvoId: cartaoId, mes } },
    create: { pessoaId, tipo: "fatura", alvoId: cartaoId, mes, valor, quando: agora },
    update: { valor, quando: agora },
  });
}

export async function desfazerFatura(pessoaId: string, cartaoId: string, vence: string): Promise<void> {
  await prisma().pagamento.deleteMany({ where: { pessoaId, tipo: "fatura", alvoId: cartaoId, mes: vence.slice(0, 7) } });
}

const proximoMes = (agora: Date) => {
  const [a, m] = hojeEmBrasilia(agora).split("-").map(Number);
  return new Date(m === 12 ? a + 1 : a, m === 12 ? 0 : m, 15, 12);
};

export async function dinheiroDaPessoa(pessoaId: string, agora = new Date()): Promise<DinheiroDaPessoa> {
  const hoje = hojeEmBrasilia(agora);
  const [cartoes, contasDoBanco, todasAsCompras, pagamentos, saldoInf, lancamentos, rendaDaPessoa, contas, dividasDaPessoa, planoDaPessoa] = await Promise.all([
    cartoesDaPessoa(pessoaId),
    prisma().contaBancaria.findMany({ where: { conexao: { pessoaId } } }),
    compras(pessoaId),
    prisma().pagamento.findMany({ where: { pessoaId } }),
    prisma().saldoInformado.findUnique({ where: { pessoaId } }),
    prisma().lancamentoNaConta.findMany({ where: { pessoaId } }),
    renda(pessoaId),
    contasFixas(pessoaId),
    dividas(pessoaId),
    plano(pessoaId),
  ]);
  const pago = (cartaoId: string, vence: string) => pagamentos.some((p) => p.tipo === "fatura" && p.alvoId === cartaoId && p.mes === vence.slice(0, 7));

  // Faturas: cartões à mão pelas compras; cartões do banco pelo valor que o banco informa.
  const faturas: FaturaVista[] = [];
  for (const c of cartoes.filter((x) => x.origem === "manual")) {
    const doCartao = todasAsCompras
      .filter((x) => x.meio === "cartao" && x.cartaoId === c.id)
      // Sem o valor da parcela: a fatura divide o total e o resto vai na primeira.
      .map((x) => ({ id: x.id, dia: hojeEmBrasilia(new Date(x.quando)), valor: x.valor, parcelas: x.parcelas, valorDaParcela: null }));
    for (const f of faturasDoCartao(c, doCartao)) {
      if (!pago(c.id, f.vence)) faturas.push({ cartaoId: c.id, cartao: c.nome, origem: "manual", fecha: f.fecha, vence: f.vence, valor: f.valor });
    }
  }
  for (const c of contasDoBanco.filter((x) => x.tipo === "cartao" && x.vencimento && x.saldo > 0)) {
    if (!pago(c.id, c.vencimento!)) faturas.push({ cartaoId: c.id, cartao: c.nome, origem: "banco", fecha: c.fechamento, vence: c.vencimento!, valor: c.saldo });
  }
  faturas.sort((a, b) => a.vence.localeCompare(b.vence));

  const correntes = contasDoBanco.filter((x) => x.tipo !== "cartao");
  const conectado = correntes.length > 0;
  let saldo: number | null = null;
  let extrato: DinheiroDaPessoa["extrato"] = [];
  if (conectado) {
    saldo = correntes.reduce((s, c) => s + c.saldo, 0);
  } else if (saldoInf) {
    const nomeDoAlvo = new Map([...contas.map((c) => [c.id, c.nome] as const), ...dividasDaPessoa.map((d) => [d.id, d.nome] as const), ...cartoes.map((c) => [c.id, `Fatura ${c.nome}`] as const)]);
    // No mesmo dia do saldo informado, conta só o que foi registrado depois dele.
    const depois = (d: Date) => d.getTime() > saldoInf.quando.getTime();
    const movimentos: DinheiroDaPessoa["extrato"] = [
      ...todasAsCompras
        .filter((x) => x.meio === "conta")
        .map((x) => ({ dia: hojeEmBrasilia(new Date(x.quando)), valor: -x.valor, descricao: x.item, tipo: "compra" as const, depoisDoSaldo: depois(new Date(x.quando)) })),
      ...pagamentos.map((p) => ({
        dia: hojeEmBrasilia(p.quando),
        valor: -p.valor,
        descricao: nomeDoAlvo.get(p.alvoId) ?? "Pagamento",
        tipo: (p.tipo === "fatura" ? "fatura" : p.tipo === "divida" ? "divida" : "conta") as MovimentoDaConta["tipo"],
        depoisDoSaldo: depois(p.quando),
      })),
      ...lancamentos.map((l) => ({
        id: l.id,
        dia: l.dia,
        valor: l.valor,
        descricao: l.descricao,
        tipo: (l.valor >= 0 ? "entrada" : "saida") as MovimentoDaConta["tipo"],
        depoisDoSaldo: depois(l.criadoEm),
      })),
    ];
    const r = saldoDaConta({ saldoInformado: saldoInf.valor, desde: saldoInf.desde, renda: rendaDaPessoa, movimentos }, hoje);
    saldo = r.saldo;
    extrato = r.extrato;
  }

  let previsao: PrevisaoDoDinheiro | null = null;
  if (saldo !== null) {
    const mes = hoje.slice(0, 7);
    const doMes = pagamentos.filter((p) => p.mes === mes).map((p) => ({ tipo: p.tipo as "conta" | "divida", alvoId: p.alvoId, mes: p.mes, valor: p.valor, quando: p.quando.toISOString() }));
    const planoDoMes = { valorMensal: planoDaPessoa.valorMensal, estrategia: planoDaPessoa.estrategia as Estrategia };
    const aPagarEsteMes = compromissosDoMes(contas, dividasDaPessoa, planoDoMes, doMes, agora)
      .filter((c) => !c.pago)
      .reduce((s, c) => s + c.valor, 0);
    const compromissosDoMesQueVem = compromissosDoMes(contas, dividasDaPessoa, planoDoMes, [], proximoMes(agora)).reduce((s, c) => s + c.valor, 0);
    previsao = previsaoDoDinheiro({ hoje, saldo, renda: rendaDaPessoa, aPagarEsteMes, compromissosDoMesQueVem, faturas });
  }

  return { compartilhado: true, conectado, saldo, desde: saldoInf?.desde ?? null, extrato, cartoes, faturas, previsao };
}
