import { formatarReais } from "@/lib/dinheiro";
import { NOME_DA_CATEGORIA, type Lancamento } from "./lancamentos";
import type { LinhaDoPlano } from "./plano";
import { CORTE_SUGERIDO, META_DE_POUPANCA, type Periodo, type Resumo } from "./resumo";

/** Mensagens montadas pelo código. Negrito no padrão do WhatsApp: *assim*. */

export const BOAS_VINDAS = [
  "Oi! Eu sou a *Luana*. Organizo seus gastos aqui na conversa.",
  "Me mande a *fatura do cartão* ou o *extrato da conta* (PDF ou foto), um *print das compras* do app do banco, ou escreva (ou grave um áudio contando) o que gastou, tipo _almoço 35_.",
  "Não quer mandar arquivo? Escreva _prefiro contar_ e eu te pergunto o básico: quanto entra, as contas fixas, o cartão e o que você tem guardado.",
  "Eu separo por categoria, somo o dia e o mês, mostro quanto entrou, quanto saiu, quanto foi de juros e IOF e onde dá para economizar. Também faço a conta se você perguntar _posso comprar isso?_",
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

const comMaiuscula = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1);

/** Uma linha do orçamento: previsto, o que já foi e o que resta. */
function linhaDoPlano(l: LinhaDoPlano): string {
  const unico = l.itens.length === 1;
  const nome = !unico
    ? `${l.nome} (${l.itens.map((i) => i.descricao.toLowerCase()).join(", ")})`
    : l.grupo === "cartao"
      ? l.nome
      : comMaiuscula(l.itens[0].descricao);
  if (l.realizado === 0) return `• ${nome}: ${formatarReais(l.previsto)}`;
  const situacao =
    l.realizado <= l.previsto
      ? `restam ${formatarReais(l.previsto - l.realizado)}`
      : `passou ${formatarReais(l.realizado - l.previsto)}`;
  return `• ${nome}: previsto ${formatarReais(l.previsto)}, já foram ${formatarReais(l.realizado)}, ${situacao}`;
}

/** O mês contado de cabeça: previsto contra realizado. Null sem despesas informadas. */
export function blocoDoPlano(r: Resumo): string | null {
  const p = r.plano;
  if (!p) return null;
  const linhas = p.linhas.map(linhaDoPlano);
  if (r.poupanca) linhas.unshift(`• Entra: ${formatarReais(r.poupanca.renda)}`);
  if (p.foraDoPlano > 0) linhas.push(`• Gastos fora do previsto: ${formatarReais(p.foraDoPlano)}`);
  if (p.encargos > 0) linhas.push(`• Juros, IOF e tarifas: ${formatarReais(p.encargos)}`);
  linhas.push(`• Deve sair no mês: ${formatarReais(p.esperado)}`);
  if (r.poupanca) {
    const sobra = r.poupanca.sobraDoMes;
    linhas.push(sobra >= 0 ? `• *Sobra prevista: ${formatarReais(sobra)}*` : `• *Falta: ${formatarReais(-sobra)}*`);
  }
  if (r.reserva) linhas.push(`• Guardado à parte: ${formatarReais(r.reserva)} (fora da conta do mês)`);
  return `*${comMaiuscula(nomeDoMes(r.mes.referencia))}, pelo que você me contou*\n${linhas.join("\n")}\n_Valores informados por você, sem conferir em extrato. Em cada item vale o maior entre o previsto e o que já anotei._`;
}

/** Depois de um gasto anotado: como ficou o previsto das categorias mexidas. */
export function blocoDoPlanoPara(r: Resumo, novos: Lancamento[]): string | null {
  if (!r.plano) return null;
  const categorias = new Set<string>(novos.filter((l) => l.natureza === "compra").map((l) => l.categoria));
  const comPrevisao = new Set<string>(r.plano.linhas.map((l) => l.grupo));
  // O cartão recebe os gastos das categorias que não têm previsão própria.
  const caiuNoCartao = [...categorias].some((c) => !comPrevisao.has(c));
  const linhas = r.plano.linhas.filter(
    (l) => l.realizado > 0 && (l.grupo === "cartao" ? caiuNoCartao : categorias.has(l.grupo)),
  );
  return linhas.length > 0 ? `*No seu previsto*\n${linhas.map(linhaDoPlano).join("\n")}` : null;
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
  const com = p.comPrevisao ? "Contando o que você previu e o que já anotei" : "Com os gastos que tenho anotados";
  const passou = p.comPrevisao ? "O previsto e o anotado já passam" : "Os gastos anotados já passaram";
  const origem =
    p.base === "entradas_do_mes"
      ? `Usando como renda o que entrou no mês (${formatarReais(p.renda)}), para`
      : "Para";
  const situacao =
    p.sobraDoMes >= p.meta
      ? `${com}, sobram ${formatarReais(p.sobraDoMes)}: dá para bater a meta.`
      : p.sobraDoMes > 0
        ? `${com}, sobram ${formatarReais(p.sobraDoMes)}: faltam ${formatarReais(p.meta - p.sobraDoMes)} para a meta.`
        : `${passou} da renda em ${formatarReais(-p.sobraDoMes)}.`;
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
      guardadoAParte: r.reserva ? formatarReais(r.reserva) : "não informado",
      orcamento: r.plano
        ? {
            itens: r.plano.linhas.map((l) => ({
              item: l.grupo !== "cartao" && l.itens.length === 1 ? l.itens[0].descricao : l.nome,
              previsto: formatarReais(l.previsto),
              jaAnotado: formatarReais(l.realizado),
              resta: l.realizado <= l.previsto ? formatarReais(l.previsto - l.realizado) : "estourou",
              passouDoPrevistoEm: l.realizado > l.previsto ? formatarReais(l.realizado - l.previsto) : "não passou",
            })),
            deveSairNoMes: formatarReais(r.plano.esperado),
            sobraPrevista: r.poupanca ? formatarReais(r.poupanca.sobraDoMes) : "sem renda informada",
          }
        : "a pessoa não informou despesas mensais",
      sugestoesCalculadas: dicas(r),
    },
    null,
    1,
  );
}
