import { formatarReais } from "@/lib/dinheiro";
import { NOME_DA_CATEGORIA, type Lancamento } from "./lancamentos";
import { CORTE_SUGERIDO, META_DE_POUPANCA, type Periodo, type Resumo } from "./resumo";

/** Mensagens montadas pelo código. Negrito no padrão do WhatsApp: *assim*. */

export const BOAS_VINDAS = [
  "Oi! Eu sou a *Luana*. Organizo seus gastos aqui na conversa.",
  "Me mande a *fatura do cartão* ou o *extrato da conta* (PDF ou foto), um *print das compras* do app do banco, ou escreva o que gastou, tipo _almoço 35_.",
  "Eu separo por categoria, somo o dia e o mês, mostro quanto entrou, quanto saiu, quanto foi de juros e IOF e onde dá para economizar.",
].join("\n\n");

export const AVISO = "_Orientação educativa. Não é recomendação de investimento ou crédito._";

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export function nomeDoMes(referencia: string): string {
  const [ano, mes] = referencia.split("-");
  return `${MESES[Number(mes) - 1] ?? referencia} de ${ano}`;
}

export function dataCurta(iso: string): string {
  const [, mes, dia] = iso.split("-");
  return `${dia}/${mes}`;
}

function linhasPorCategoria(p: Periodo): string {
  return p.porCategoria
    .map((c) => `• ${NOME_DA_CATEGORIA[c.categoria]}: ${formatarReais(c.total)} (${c.percentual}%)`)
    .join("\n");
}

export function blocoDoMes(r: Resumo): string {
  if (r.mes.quantidade === 0) return `Ainda não tenho compras de ${nomeDoMes(r.mes.referencia)}.`;
  return `*Gastos de ${nomeDoMes(r.mes.referencia)}: ${formatarReais(r.mes.total)}*\n${linhasPorCategoria(r.mes)}`;
}

/** Quanto entrou, quanto saiu e o que sobrou; null se não há entradas conhecidas. */
export function blocoDeEntradasESaidas(r: Resumo): string | null {
  const m = r.mes;
  if (m.saldo === null) return null;
  const linhas = [
    `• Entrou: ${formatarReais(m.entradas.total)}`,
    `• Saiu em gastos: ${formatarReais(m.total)}`,
    m.encargos.total > 0 && `• Saiu em juros, IOF e tarifas: ${formatarReais(m.encargos.total)}`,
    m.saldo >= 0 ? `• *Sobrou: ${formatarReais(m.saldo)}*` : `• *Faltou: ${formatarReais(-m.saldo)}*`,
  ].filter(Boolean);
  const partes = [`*Entradas e saídas de ${nomeDoMes(m.referencia)}*\n${linhas.join("\n")}`];
  if (m.entradas.maiores.length > 0) {
    const itens = m.entradas.maiores.map((l) => `• ${dataCurta(l.data)} ${l.descricao}: ${formatarReais(l.valor)}`);
    partes.push(`Maiores entradas:\n${itens.join("\n")}`);
  }
  if (m.porOrigem.length > 0) {
    const itens = m.porOrigem.map(
      (o) => `• ${o.origem}: entrou ${formatarReais(o.entradas)}, saiu ${formatarReais(o.saidas)}`,
    );
    partes.push(`Por banco:\n${itens.join("\n")}`);
  }
  if (m.faturasPagas > 0) {
    partes.push(
      `_Fatura de cartão paga pela conta: ${formatarReais(m.faturasPagas)}. Não somei nas saídas para não contar duas vezes as compras do cartão._`,
    );
  }
  return partes.join("\n\n");
}

/**
 * Aviso para quando o arquivo recebido é de um mês diferente do que aparece
 * no resumo (que mostra sempre o mês mais recente).
 */
export function avisoDeOutroMes(novos: Lancamento[], r: Resumo): string | null {
  const mes = novos.map((l) => l.data.slice(0, 7)).sort().at(-1);
  if (!mes || mes === r.mes.referencia) return null;
  const gastos = novos.filter((l) => l.natureza === "compra" && l.data.startsWith(mes));
  const total = gastos.reduce((s, l) => s + l.valor, 0);
  return `Esse arquivo é de ${nomeDoMes(mes)}: ${formatarReais(total)} em gastos. Guardei tudo para comparar; o resumo abaixo é do mês mais recente que tenho, ${nomeDoMes(r.mes.referencia)}.`;
}

/** As maiores compras do mês, da maior para a menor. */
export function blocoDeMaiores(r: Resumo): string | null {
  if (r.mes.maiores.length === 0) return null;
  return `*Maiores gastos*\n${listar(r.mes.maiores)}`;
}

export function blocoDeHoje(r: Resumo): string {
  if (r.hoje.quantidade === 0) return `Hoje (${dataCurta(r.hoje.data)}) ainda não anotei nenhum gasto.`;
  return `*Hoje (${dataCurta(r.hoje.data)}): ${formatarReais(r.hoje.total)}*\n${linhasPorCategoria(r.hoje)}`;
}

export function blocoDeEncargos(r: Resumo): string | null {
  const e = r.mes.encargos;
  if (e.total === 0) return null;
  const linhas = [
    e.juros > 0 && `• Juros: ${formatarReais(e.juros)}`,
    e.iof > 0 && `• IOF: ${formatarReais(e.iof)}`,
    e.tarifas > 0 && `• Tarifas e multas: ${formatarReais(e.tarifas)}`,
  ].filter(Boolean);
  return `*Juros, IOF e tarifas: ${formatarReais(e.total)}*\n${linhas.join("\n")}`;
}

/** Sugestões calculadas pelo código a partir do resumo. */
export function dicas(r: Resumo): string[] {
  const lista: string[] = [];
  const e = r.mes.encargos;
  if (e.total > 0 && e.juros + e.iof === 0) {
    lista.push(
      `Você pagou ${formatarReais(e.total)} em tarifas. Vale perguntar ao banco pelo pacote de serviços essenciais, que é gratuito por norma do Banco Central.`,
    );
  } else if (e.total > 0) {
    lista.push(
      `Você pagou ${formatarReais(e.total)} só de juros, IOF e tarifas. Pagar a fatura inteira até o vencimento zera esse custo.`,
    );
  }
  if (r.jurosSePagarSoOMinimo) {
    lista.push(
      `Se pagar só o mínimo desta fatura, o resto entra no rotativo e gera cerca de ${formatarReais(r.jurosSePagarSoOMinimo)} de juros no mês seguinte.`,
    );
  }
  if (r.corte) {
    lista.push(
      `${NOME_DA_CATEGORIA[r.corte.categoria]} é seu maior gasto ajustável: ${formatarReais(r.corte.total)}. Cortar ${CORTE_SUGERIDO * 100}% guarda ${formatarReais(r.corte.economia)} por mês.`,
    );
  }
  if (r.mes.assinaturas.length > 0) {
    const total = r.mes.assinaturas.reduce((s, l) => s + l.valor, 0);
    const n = r.mes.assinaturas.length;
    lista.push(
      `Você tem ${n} ${n === 1 ? "assinatura" : "assinaturas"} somando ${formatarReais(total)}. Vale conferir se usa ${n === 1 ? "ela" : "todas"}.`,
    );
  }
  lista.push(blocoDePoupanca(r));
  return lista;
}

export function blocoDePoupanca(r: Resumo): string {
  if (!r.poupanca) {
    return "Me diga sua renda mensal (ex.: _ganho 4000_) que eu calculo quanto dá para guardar.";
  }
  const p = r.poupanca;
  const origem =
    p.base === "entradas_do_mes"
      ? `Usando como renda o que entrou no mês (${formatarReais(p.renda)}), para`
      : "Para";
  const situacao =
    p.sobraDoMes >= p.meta
      ? `Com os gastos que tenho anotados, sobram ${formatarReais(p.sobraDoMes)}: dá para bater a meta.`
      : p.sobraDoMes > 0
        ? `Com os gastos que tenho anotados, sobram ${formatarReais(p.sobraDoMes)}: faltam ${formatarReais(p.meta - p.sobraDoMes)} para a meta.`
        : `Os gastos anotados já passaram da renda em ${formatarReais(-p.sobraDoMes)}.`;
  return `${origem} guardar ${META_DE_POUPANCA * 100}% da renda, a meta é ${formatarReais(p.meta)} por mês, com gastos de até ${formatarReais(p.tetoDeGastos)}. ${situacao}`;
}

export function listar(itens: Lancamento[]): string {
  return itens
    .map(
      (l) =>
        `• ${dataCurta(l.data)} ${l.descricao}: ${formatarReais(l.valor)} (${l.natureza === "entrada" ? "entrada" : NOME_DA_CATEGORIA[l.categoria]})`,
    )
    .join("\n");
}

/** Resumo com valores já formatados, entregue ao modelo para ele redigir respostas. */
export function resumoParaIA(r: Resumo, renda: number | null, saldo: number | null): string {
  const cat = (p: Periodo) =>
    p.porCategoria.map((c) => ({
      categoria: NOME_DA_CATEGORIA[c.categoria],
      total: formatarReais(c.total),
      percentual: `${c.percentual}%`,
    }));
  return JSON.stringify(
    {
      hoje: { data: r.hoje.data, total: formatarReais(r.hoje.total), compras: r.hoje.quantidade, porCategoria: cat(r.hoje) },
      mes: {
        referencia: nomeDoMes(r.mes.referencia),
        total: formatarReais(r.mes.total),
        compras: r.mes.quantidade,
        porCategoria: cat(r.mes),
        maioresCompras: r.mes.maiores.map((l) => ({
          data: dataCurta(l.data),
          descricao: l.descricao,
          valor: formatarReais(l.valor),
          categoria: NOME_DA_CATEGORIA[l.categoria],
        })),
        juros: formatarReais(r.mes.encargos.juros),
        iof: formatarReais(r.mes.encargos.iof),
        tarifasEMultas: formatarReais(r.mes.encargos.tarifas),
        entradas:
          r.mes.saldo === null
            ? "nenhuma entrada conhecida"
            : {
                total: formatarReais(r.mes.entradas.total),
                maiores: r.mes.entradas.maiores.map((l) => ({
                  data: dataCurta(l.data),
                  descricao: l.descricao,
                  valor: formatarReais(l.valor),
                })),
              },
        totalQueSaiu: formatarReais(r.mes.saidas),
        sobraDoMes: r.mes.saldo === null ? "sem entradas para comparar" : formatarReais(r.mes.saldo),
        faturasDeCartaoPagasPelaConta: formatarReais(r.mes.faturasPagas),
        porBanco: r.mes.porOrigem.map((o) => ({
          banco: o.origem,
          entrou: formatarReais(o.entradas),
          saiu: formatarReais(o.saidas),
        })),
      },
      mesAnterior: r.mesAnterior
        ? {
            referencia: nomeDoMes(r.mesAnterior.referencia),
            total: formatarReais(r.mesAnterior.total),
            compras: r.mesAnterior.quantidade,
            porCategoria: cat(r.mesAnterior),
            jurosIofETarifas: formatarReais(r.mesAnterior.encargos),
            entradas: formatarReais(r.mesAnterior.entradas),
          }
        : "sem dados",
      rendaMensal: renda ? formatarReais(renda) : "não informada",
      saldoEmConta: saldo !== null ? formatarReais(saldo) : "não informado",
      sugestoesCalculadas: dicas(r),
    },
    null,
    1,
  );
}
