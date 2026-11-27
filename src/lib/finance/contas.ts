/**
 * Contas do mês: contas fixas e parcelas do plano das dívidas, o que já foi
 * pago, o que falta e quanto sobra da renda. Valores em centavos.
 */
import { chaveDoMes } from "./datas";
import { simularQuitacao, somaDosMinimos } from "./dividas";
import type { CategoriaDaConta, ContaFixa, Divida, Estrategia, Pagamento, Renda } from "./tipos";

export const NOME_DA_CATEGORIA_DA_CONTA: Record<CategoriaDaConta, string> = {
  moradia: "Moradia",
  luz: "Luz",
  agua: "Água",
  internet: "Internet e celular",
  transporte: "Transporte",
  saude: "Saúde",
  educacao: "Educação",
  assinatura: "Assinatura",
  outra: "Outra",
};

/** Contas que vencem em até 3 dias aparecem como "vence em breve". */
export const DIAS_DE_ANTECEDENCIA = 3;

export interface Compromisso {
  tipo: "conta" | "divida";
  id: string;
  nome: string;
  /** Categoria da conta; nas dívidas, "outra". */
  categoria: CategoriaDaConta;
  /** Dia do vencimento neste mês. */
  dia: number;
  /** Centavos: o que foi pago, ou o previsto se ainda não pagou. */
  valor: number;
  pago: boolean;
  /** Pago por débito automático (sem a pessoa marcar). */
  automatico: boolean;
  /** Assinatura no cartão: vem na fatura dele, nada a pagar à parte. */
  noCartao: boolean;
  vencida: boolean;
  emBreve: boolean;
  /** Valor estimado (conta que muda todo mês e ainda não foi paga). */
  estimado: boolean;
}

export interface TotaisDoMes {
  contas: number;
  parcelas: number;
  total: number;
  pago: number;
  falta: number;
  /** 0 a 1. */
  fracaoPaga: number;
  renda: number | null;
  /** Renda menos os compromissos; null sem renda informada. */
  sobra: number | null;
}

const diasNoMes = (agora: Date) => new Date(agora.getFullYear(), agora.getMonth() + 1, 0).getDate();

/** Vencimento no dia 31 cai no último dia dos meses mais curtos. */
export function diaDoVencimento(vencimento: number, agora: Date): number {
  return Math.min(Math.max(1, vencimento), diasNoMes(agora));
}

const pagamentoDe = (pagamentos: Pagamento[], tipo: Pagamento["tipo"], id: string, mes: string) =>
  pagamentos.find((p) => p.tipo === tipo && p.alvoId === id && p.mes === mes);

/** Contas fixas e parcelas do plano das dívidas no mês de `agora`. */
export function compromissosDoMes(
  contas: ContaFixa[],
  dividas: Divida[],
  plano: { valorMensal: number; estrategia: Estrategia },
  pagamentos: Pagamento[],
  agora: Date,
): Compromisso[] {
  const mes = chaveDoMes(agora);
  const hoje = agora.getDate();
  const estado = (dia: number, pago: boolean) => ({
    vencida: !pago && dia < hoje,
    emBreve: !pago && dia >= hoje && dia - hoje <= DIAS_DE_ANTECEDENCIA,
  });

  const daConta = contas.map((c): Compromisso => {
    const dia = diaDoVencimento(c.vencimento, agora);
    const registro = pagamentoDe(pagamentos, "conta", c.id, mes);
    const noCartao = Boolean(c.cartao);
    const automatico = !registro && (noCartao || (c.debitoAutomatico && dia <= hoje));
    const pago = Boolean(registro) || automatico;
    return {
      tipo: "conta",
      id: c.id,
      nome: c.nome,
      categoria: c.categoria,
      dia,
      valor: registro?.valor ?? c.valor,
      pago,
      automatico,
      noCartao,
      estimado: c.variavel && !registro,
      ...estado(dia, pago),
    };
  });

  const abertas = dividas.filter((d) => d.saldo > 0);
  const doPlano = abertas.length
    ? simularQuitacao(abertas, Math.max(plano.valorMensal, somaDosMinimos(abertas)), plano.estrategia).pagamentoPrimeiroMes
    : {};
  const daDivida = abertas
    .filter((d) => (doPlano[d.id] ?? 0) > 0)
    .map((d): Compromisso => {
      const dia = diaDoVencimento(d.vencimento, agora);
      const registro = pagamentoDe(pagamentos, "divida", d.id, mes);
      const pago = Boolean(registro);
      return {
        tipo: "divida",
        id: d.id,
        nome: d.nome,
        categoria: "outra",
        dia,
        valor: registro?.valor ?? doPlano[d.id],
        pago,
        automatico: false,
        noCartao: false,
        estimado: false,
        ...estado(dia, pago),
      };
    });

  return [...daConta, ...daDivida].sort((a, b) => a.dia - b.dia || a.nome.localeCompare(b.nome));
}

export function totaisDoMes(compromissos: Compromisso[], renda: Renda | null): TotaisDoMes {
  const soma = (l: Compromisso[]) => l.reduce((s, c) => s + c.valor, 0);
  const contas = soma(compromissos.filter((c) => c.tipo === "conta"));
  const parcelas = soma(compromissos.filter((c) => c.tipo === "divida"));
  const total = contas + parcelas;
  const pago = soma(compromissos.filter((c) => c.pago));
  const valorDaRenda = renda && renda.valor > 0 ? renda.valor : null;
  return {
    contas,
    parcelas,
    total,
    pago,
    falta: total - pago,
    fracaoPaga: total ? pago / total : 0,
    renda: valorDaRenda,
    sobra: valorDaRenda === null ? null : valorDaRenda - total,
  };
}

/** Quanto vai para cada categoria de conta fixa, da maior para a menor. */
export function contasPorCategoria(contas: ContaFixa[]): { categoria: CategoriaDaConta; valor: number }[] {
  const por = new Map<CategoriaDaConta, number>();
  for (const c of contas) por.set(c.categoria, (por.get(c.categoria) ?? 0) + c.valor);
  return [...por].map(([categoria, valor]) => ({ categoria, valor })).sort((a, b) => b.valor - a.valor);
}

/** Grupos da lista de vencimentos, na ordem em que aparecem. */
export function gruposDeVencimento(compromissos: Compromisso[], agora: Date) {
  const hoje = agora.getDate();
  const abertos = compromissos.filter((c) => !c.pago && !c.vencida);
  return [
    { titulo: "Vencidas", itens: compromissos.filter((c) => c.vencida) },
    { titulo: "Próximos 7 dias", itens: abertos.filter((c) => c.dia - hoje <= 7) },
    { titulo: "Mais para o fim do mês", itens: abertos.filter((c) => c.dia - hoje > 7) },
    { titulo: "Pagas", itens: compromissos.filter((c) => c.pago) },
  ].filter((g) => g.itens.length);
}
