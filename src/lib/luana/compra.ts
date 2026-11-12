import { formatarReais } from "@/lib/dinheiro";
import type { Conta, Resumo } from "./resumo";

/**
 * "Posso comprar?": a conta é feita aqui, com a renda e as saídas conhecidas.
 * O modelo de IA só extrai da mensagem o que a pessoa quer comprar.
 */

/** Sobra mínima depois da parcela, como fração da renda, para dizer que cabe. */
export const FOLGA_MINIMA = 0.1;

export interface PedidoDeCompra {
  item: string;
  /** Preço à vista ou total, em centavos. */
  valorTotal: number | null;
  /** Valor de cada parcela, em centavos. */
  parcela: number | null;
  numeroDeParcelas: number | null;
  /** Soma das contas mensais que a pessoa citou na mensagem. */
  compromissosCitados: number;
}

export type Veredito = "sem_dados" | "nao_cabe" | "quite_antes" | "aperta" | "cabe" | "junte_antes";

export interface AnaliseDeCompra {
  item: string;
  veredito: Veredito;
  renda: number | null;
  origemDaRenda: "informada" | "entradas_do_mes" | null;
  saidas: number;
  origemDasSaidas: "anotadas" | "citadas";
  /** Renda menos saídas, antes da compra. */
  sobra: number | null;
  parcela: number | null;
  /** true quando a parcela foi estimada dividindo o total, sem juros. */
  parcelaSemJuros: boolean;
  /** Parcela como parte da renda, de 0 a 100. */
  comprometimento: number | null;
  sobraDepois: number | null;
  /** Soma das parcelas, quando dá para calcular. */
  totalParcelado: number | null;
  /** Quanto o parcelado custa a mais que o preço à vista. */
  custoDoParcelamento: number | null;
  /** Juros, IOF e tarifas que a pessoa já paga no mês. */
  encargosAtuais: number;
  /** Meses guardando toda a sobra para comprar à vista. */
  mesesParaJuntar: number | null;
}

export function analisarCompra(pedido: PedidoDeCompra, conta: Conta, r: Resumo): AnaliseDeCompra {
  const renda = conta.rendaMensal ?? (r.mes.entradas.total > 0 ? r.mes.entradas.total : null);
  const origemDaRenda = conta.rendaMensal ? "informada" : renda ? "entradas_do_mes" : null;
  const citadas = pedido.compromissosCitados > r.mes.saidas;
  const saidas = citadas ? pedido.compromissosCitados : r.mes.saidas;
  const sobra = renda === null ? null : renda - saidas;

  const estimada = !pedido.parcela && !!pedido.valorTotal && !!pedido.numeroDeParcelas;
  const parcela =
    pedido.parcela ??
    (estimada ? Math.round((pedido.valorTotal as number) / (pedido.numeroDeParcelas as number)) : null);
  const totalParcelado = pedido.parcela && pedido.numeroDeParcelas ? pedido.parcela * pedido.numeroDeParcelas : null;
  const custoDoParcelamento =
    totalParcelado && pedido.valorTotal && totalParcelado > pedido.valorTotal
      ? totalParcelado - pedido.valorTotal
      : null;
  const sobraDepois = sobra !== null && parcela ? sobra - parcela : null;
  const encargosAtuais = r.mes.encargos.juros + r.mes.encargos.iof;

  let veredito: Veredito;
  if (renda === null || sobra === null || (!parcela && !pedido.valorTotal)) veredito = "sem_dados";
  else if (sobra <= 0) veredito = "nao_cabe";
  else if (parcela) {
    if ((sobraDepois as number) < 0) veredito = "nao_cabe";
    else if (encargosAtuais > 0) veredito = "quite_antes";
    else if ((sobraDepois as number) < Math.round(renda * FOLGA_MINIMA)) veredito = "aperta";
    else veredito = "cabe";
  } else veredito = encargosAtuais > 0 ? "quite_antes" : "junte_antes";

  return {
    item: pedido.item,
    veredito,
    renda,
    origemDaRenda,
    saidas,
    origemDasSaidas: citadas ? "citadas" : "anotadas",
    sobra,
    parcela,
    parcelaSemJuros: estimada,
    comprometimento: renda && parcela ? Math.round((parcela / renda) * 100) : null,
    sobraDepois,
    totalParcelado,
    custoDoParcelamento,
    encargosAtuais,
    mesesParaJuntar:
      !parcela && pedido.valorTotal && sobra !== null && sobra > 0 ? Math.ceil(pedido.valorTotal / sobra) : null,
  };
}

const TITULO: Record<Veredito, string> = {
  sem_dados: "ainda não dá para dizer",
  nao_cabe: "não cabe agora",
  quite_antes: "melhor quitar os juros antes",
  aperta: "cabe, mas fica apertado",
  cabe: "cabe no seu mês",
  junte_antes: "dá para juntar e comprar à vista",
};

/** Resposta montada pelo código, com as contas à mostra. */
export function blocoDeCompra(a: AnaliseDeCompra): string {
  const item = a.item.charAt(0).toUpperCase() + a.item.slice(1);
  const titulo = `*${item}: ${TITULO[a.veredito]}*`;

  if (a.veredito === "sem_dados") {
    const falta =
      a.renda === null
        ? "quanto você ganha por mês (ex.: _ganho 4000_) ou o extrato da conta"
        : "o preço ou o valor da parcela";
    return `${titulo}\nPara fazer a conta eu preciso saber ${falta}.`;
  }

  const linhas = [
    `• Renda: ${formatarReais(a.renda as number)} (${a.origemDaRenda === "informada" ? "a que você me disse" : "o que entrou no mês"})`,
    `• Contas do mês: ${formatarReais(a.saidas)} (${a.origemDasSaidas === "citadas" ? "as que você citou" : "as que tenho anotadas"})`,
    `• Sobra hoje: ${formatarReais(a.sobra as number)}`,
  ];
  if (a.parcela) {
    linhas.push(
      `• Parcela: ${formatarReais(a.parcela)} (${a.comprometimento}% da renda)${a.parcelaSemJuros ? ", sem contar juros" : ""}`,
      `• Sobra depois da parcela: ${formatarReais(a.sobraDepois as number)}`,
    );
  }

  const conclusao: Record<Exclude<Veredito, "sem_dados">, string> = {
    nao_cabe:
      (a.sobra as number) <= 0
        ? "Suas contas já usam toda a renda. Assumir essa compra agora significa atrasar outra conta ou entrar no rotativo."
        : "A parcela é maior do que sobra no mês. Você teria que cortar outro gasto ou se endividar para pagar.",
    quite_antes: `Você já paga ${formatarReais(a.encargosAtuais)} de juros e IOF por mês. Vale quitar essa dívida primeiro: ela custa mais do que qualquer desconto na compra.`,
    aperta: `Sobraria menos de ${FOLGA_MINIMA * 100}% da renda para imprevistos. Se puder, espere ou procure uma parcela menor.`,
    cabe: `Sobra mais de ${FOLGA_MINIMA * 100}% da renda depois da parcela. Cabe, desde que as contas do mês não aumentem.`,
    junte_antes: a.mesesParaJuntar
      ? `Guardando toda a sobra, você junta o valor em ${a.mesesParaJuntar} ${a.mesesParaJuntar === 1 ? "mês" : "meses"} e compra sem juros.`
      : "Guardando a sobra do mês você compra sem juros.",
  };

  const partes = [titulo, linhas.join("\n"), conclusao[a.veredito]];
  if (a.custoDoParcelamento && a.totalParcelado) {
    partes.push(
      `No parcelado você paga ${formatarReais(a.totalParcelado)} no total, ${formatarReais(a.custoDoParcelamento)} a mais que o preço à vista.`,
    );
  }
  if (a.parcelaSemJuros) {
    partes.push("Calculei a parcela dividindo o preço, sem juros. Com financiamento ela fica maior: me diga o valor real da parcela para eu refazer a conta.");
  }
  return partes.join("\n\n");
}
