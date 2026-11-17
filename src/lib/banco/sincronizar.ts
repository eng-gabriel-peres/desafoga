/**
 * Sincroniza uma conexão com a Pluggy: contas, transações, empréstimos e a
 * fatura aberta de cada cartão. Idempotente: rodar duas vezes não duplica
 * nada. Chamada pelo webhook, ao abrir o app e pelo botão "Atualizar".
 */
import { avisoDeCompraDoBanco, avisoDeConsentimento, avisoDeDividaEncontrada, avisoDeLimiteDoCartao, avisoDeSeguro, mensagemDeCompraDoBanco } from "@/lib/assistente/textos";
import { rendaDetectada, usoDoLimite } from "./extras";
import { fundirFaturas, type Compra, type Fatura, type Lancamento } from "@/lib/finance";
import * as repo from "@/lib/desafoga/servidor/repositorio";
import { categoriaDe, chaveDaDescricao, naturezaDe } from "./classificar";
import { sugestaoDoChequeEspecial, sugestaoDoEmprestimo, chaveDaDivida, aplicarTravas } from "./dividas";
import { candidataDoMovimento, diaEmBrasilia, normalizarConta, normalizarTransacao } from "./normalizar";
import { chaveDaInstituicao } from "./instituicoes";
import { clientePluggy, type ClientePluggy } from "./pluggy";
import { compraManualCorrespondente, novaParcelada, paresDeTransferencia } from "./relacionar";
import type { ContaBancaria, ModoCompras, Movimento, SugestaoDeDivida } from "./tipos";

export interface ResultadoDaSincronizacao {
  contas: number;
  novos: number;
  paraRevisar: number;
  automaticas: number;
  sugestoes: number;
  erro: string | null;
}

const VAZIO: ResultadoDaSincronizacao = { contas: 0, novos: 0, paraRevisar: 0, automaticas: 0, sugestoes: 0, erro: null };
const DIA = 86_400_000;
const UMA_HORA = 60 * 60 * 1000;
/** Só compras desta janela (antes da conexão) viram aviso; o resto é histórico. */
const JANELA_DE_AVISO_DIAS = 7;
/** Só estes pedem a pessoa de volta. OUTDATED costuma ser passageiro: lê o que já existe. */
const PRECISA_DA_PESSOA = new Set(["LOGIN_ERROR", "WAITING_USER_ACTION", "WAITING_USER_INPUT"]);
const ERRO_PARA_A_PESSOA = "Não consegui ler o banco agora. Tente atualizar daqui a pouco.";

function somarMeses(dia: string, n: number): string {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
}

export async function sincronizar(
  conexaoId: string,
  /** releituraDias: relê as transações dos últimos N dias (transações antigas que o banco atualizou). */
  o: { cliente?: ClientePluggy; agora?: Date; pedirAtualizacao?: boolean; releituraDias?: number } = {},
): Promise<ResultadoDaSincronizacao> {
  const agora = o.agora ?? new Date();
  const conexao = await repo.conexao(conexaoId);
  if (!conexao?.pluggyItemId) return VAZIO;
  if (!(await repo.travarSincronizacao(conexaoId, agora))) return VAZIO;

  const resultado = { ...VAZIO };
  try {
    const cliente = o.cliente ?? clientePluggy();
    const itemId = conexao.pluggyItemId;
    const pessoaId = conexao.pessoaId;

    if (o.pedirAtualizacao && (!conexao.ultimoPedidoDeAtualizacao || agora.getTime() - conexao.ultimoPedidoDeAtualizacao.getTime() >= UMA_HORA)) {
      await cliente.pedirAtualizacao(itemId);
      await repo.atualizarConexao(conexaoId, { ultimoPedidoDeAtualizacao: agora });
    }

    const item = await cliente.item(itemId);
    const banco = item.connector?.name ?? conexao.banco;
    if (PRECISA_DA_PESSOA.has(item.status)) {
      await repo.atualizarConexao(conexaoId, { status: "reconectar", banco });
      return resultado;
    }

    const contas = await repo.salvarContas(conexaoId, (await cliente.contas(itemId)).map(normalizarConta));
    resultado.contas = contas.length;
    // PDFs do mesmo banco enviados antes (sem cartão escolhido) passam para o cartão, se ele for o único.
    const cartoesDoBanco = contas.filter((c) => c.tipo === "cartao");
    if (cartoesDoBanco.length === 1) await repo.moverDocumentosParaCartao(pessoaId, chaveDaInstituicao(banco), cartoesDoBanco[0].id);
    const { cpf } = await cliente.identidade(itemId);
    await repo.atualizarConexao(conexaoId, {
      banco,
      logo: item.connector?.imageUrl ?? conexao.logo,
      cpfDoTitular: cpf,
      consentimentoAte: (item as { consentExpiresAt?: Date | string | null }).consentExpiresAt ? new Date((item as { consentExpiresAt: Date | string }).consentExpiresAt) : null,
    });

    const [regras, modo, compras] = await Promise.all([repo.regras(pessoaId), repo.modoCompras(pessoaId), repo.compras(pessoaId)]);
    const desde = conexao.ultimaSincronizacao ? new Date(conexao.ultimaSincronizacao.getTime() - DIA).toISOString() : undefined;

    // 1. Transações → movimentos classificados.
    const lidos: Omit<Movimento, "id">[] = [];
    for (const conta of contas) {
      const filtro = o.releituraDias ? { dataDe: diaEmBrasilia(new Date(agora.getTime() - o.releituraDias * DIA)) } : { criadasDesde: desde };
      for (const t of await cliente.transacoes(conta.pluggyAccountId, filtro)) {
        const m = { ...normalizarTransacao(t, conta.tipo), contaId: conta.id };
        const natureza = naturezaDe(m, { cpfDoTitular: cpf, regras, tipoDaConta: conta.tipo });
        const ignorar = regras.some((r) => "ignorar" in r.efeito && r.padrao === chaveDaDescricao(m.descricao));
        lidos.push({
          ...m,
          natureza,
          categoria: natureza === "compra" ? categoriaDe(m, regras) : null,
          situacao: ignorar ? "ignorada" : "historico",
          compraId: null,
          parceladaId: null,
        });
      }
    }
    // Saída num banco e entrada no outro, mesmo valor: transferência entre as próprias contas.
    const pares = new Set(paresDeTransferencia(lidos));
    for (const m of lidos) if (pares.has(m.pluggyId)) Object.assign(m, { natureza: "transferencia-propria", categoria: null });

    const { novos } = await repo.salvarMovimentos(pessoaId, lidos);
    resultado.novos = novos.length;

    // 2. Compras novas: ligar ao que já existe, ou avisar / registrar conforme o modo.
    const inicioDaJanela = diaEmBrasilia(new Date(conexao.conectadaEm.getTime() - JANELA_DE_AVISO_DIAS * DIA));
    const ligadas = new Set((await repo.movimentos(pessoaId)).map((m) => m.compraId).filter((x): x is string => Boolean(x)));
    const tipoDaConta = new Map(contas.map((c) => [c.id, c.tipo]));
    const novasCompras = novos.filter((m) => m.natureza === "compra" && m.situacao !== "ignorada").sort((a, b) => a.data.localeCompare(b.data));
    for (const m of novasCompras) {
      const r = await tratarCompraNova(pessoaId, m, { modo, compras, ligadas, naJanela: m.data >= inicioDaJanela, cartao: tipoDaConta.get(m.contaId) === "cartao", agora });
      if (r === "revisar") resultado.paraRevisar++;
      if (r === "automatica") resultado.automaticas++;
    }

    // 3. Dívidas: empréstimos, cheque especial e rotativo do cartão. Banco sem empréstimos ou faturas
    // (ou produto fora do plano) não derruba o resto da leitura.
    const sugestoes: SugestaoDeDivida[] = [];
    await semDerrubar("empréstimos", async () => {
      for (const l of await cliente.emprestimos(itemId)) {
        const s = sugestaoDoEmprestimo(l, banco, agora);
        if (s) sugestoes.push(s);
      }
    });
    for (const c of contas) {
      const s = sugestaoDoChequeEspecial(c, banco);
      if (s) sugestoes.push(s);
    }
    for (const c of contas.filter((x) => x.tipo === "cartao")) {
      await semDerrubar("faturas", async () => {
        const s = await rotativoDoCartao(pessoaId, c, banco, await cliente.faturas(c.pluggyAccountId), agora);
        if (s) sugestoes.push(s);
      });
    }
    for (const s of sugestoes) {
      if ((await repo.receberSugestaoDeDivida(pessoaId, s, { conexaoId })) === "nova") {
        resultado.sugestoes++;
        await repo.avisar(pessoaId, "divida-encontrada", avisoDeDividaEncontrada(s.nome, s.saldo), agora);
      }
      if (s.temSeguro) await repo.avisarUmaVez(pessoaId, `seguro:${s.pluggyLoanId ?? s.chave}`, "seguro", avisoDeSeguro(s.nome), agora);
    }

    // Extras: limite do cartão, autorização vencendo e renda percebida.
    await semDerrubar("extras", async () => {
      const mes = diaEmBrasilia(agora).slice(0, 7);
      for (const c of contas) {
        const uso = usoDoLimite(c);
        if (uso && uso.fracao >= 0.8) {
          await repo.avisarUmaVez(pessoaId, `limite:${c.id}:${mes}`, "limite-cartao", avisoDeLimiteDoCartao(c.nome, uso.fracao, uso.limite - uso.usado), agora);
        }
      }
      const consentimento = (item as { consentExpiresAt?: Date | string | null }).consentExpiresAt;
      if (consentimento) {
        const dias = Math.ceil((new Date(consentimento).getTime() - agora.getTime()) / DIA);
        if (dias <= 15) await repo.avisarUmaVez(pessoaId, `consentimento:${conexaoId}:${diaEmBrasilia(new Date(consentimento))}`, "consentimento", avisoDeConsentimento(banco, dias), agora);
      }
      const recentes = await repo.movimentos(pessoaId, { desde: diaEmBrasilia(new Date(agora.getTime() - 120 * DIA)) });
      const renda = rendaDetectada(recentes);
      if (renda) await repo.sugerirRenda(pessoaId, renda.valor, renda.dia);
    });

    // Investimentos (poupança, CDB, fundos): podem ser ligados a metas.
    await semDerrubar("investimentos", async () => {
      const lista = await cliente.investimentos(itemId);
      await repo.salvarInvestimentos(
        pessoaId,
        conexaoId,
        lista.map((i) => ({ pluggyId: i.id, nome: i.name, tipo: i.type, saldo: Math.round((i.balance ?? 0) * 100) })),
      );
    });

    // 4. Fatura aberta de cada cartão (alimenta a tela de fatura e os próximos meses).
    for (const c of contas.filter((x) => x.tipo === "cartao")) await semDerrubar("fatura aberta", () => gravarFaturaAberta(pessoaId, c, agora));

    await repo.atualizarConexao(conexaoId, { status: "ok", erro: null, ultimaSincronizacao: agora });
    return resultado;
  } catch (e) {
    const tecnico = e instanceof Error ? e.message.slice(0, 200) : "erro";
    console.error("Desafoga: sincronização com a Pluggy falhou,", tecnico);
    await repo.atualizarConexao(conexaoId, { status: "erro", erro: tecnico });
    // O texto técnico fica no log e na conexão; para a pessoa, uma frase clara.
    return { ...resultado, erro: ERRO_PARA_A_PESSOA };
  } finally {
    await repo.soltarSincronizacao(conexaoId);
  }
}

/** Parte opcional da leitura: se falhar, registra e segue. */
async function semDerrubar(parte: string, f: () => Promise<void>): Promise<void> {
  try {
    await f();
  } catch (e) {
    console.error(`Desafoga: Pluggy, ${parte} não lidos,`, e instanceof Error ? e.message.slice(0, 200) : "erro");
  }
}

export async function tratarCompraNova(
  pessoaId: string,
  m: Movimento,
  ctx: { modo: ModoCompras; compras: Compra[]; ligadas: Set<string>; naJanela: boolean; cartao: boolean; agora: Date },
): Promise<"revisar" | "automatica" | "registrada" | "historico"> {
  const candidata = candidataDoMovimento(m);
  const categoria = m.categoria ?? "Outro";

  if (candidata) {
    const { parcelada } = await repo.salvarParcelada(pessoaId, novaParcelada(candidata, categoria, "pluggy"));
    await repo.mudarMovimento(pessoaId, m.id, { parceladaId: parcelada.id });
    if (parcelada.compraId) {
      await repo.mudarMovimento(pessoaId, m.id, { situacao: "registrada", compraId: parcelada.compraId });
      return "registrada";
    }
    const manual = compraManualCorrespondente({ valor: m.valor, data: m.data, parcelada }, ctx.compras, ctx.ligadas, 3);
    if (manual) {
      ctx.ligadas.add(manual.id);
      await repo.ligarParceladaACompra(parcelada.id, manual.id);
      await repo.mudarMovimento(pessoaId, m.id, { situacao: "registrada", compraId: manual.id });
      return "registrada";
    }
    if (!ctx.naJanela || ctx.modo === "desligado" || (await repo.parceladaAvisada(parcelada.id))) return "historico";
    if (ctx.modo === "automatico") {
      const compra = await repo.registrarCompra(
        pessoaId,
        { item: parcelada.nome, categoria: parcelada.categoria, valor: parcelada.valorTotal, emocao: null, necessidade: null, via: "banco", parcelas: parcelada.totalParcelas, valorDaParcela: parcelada.valorParcela, parceladaId: parcelada.id },
        new Date(`${parcelada.compradaEm}T12:00:00-03:00`),
      );
      await repo.ligarParceladaACompra(parcelada.id, compra.id);
      await repo.mudarMovimento(pessoaId, m.id, { situacao: "automatica", compraId: compra.id });
      return "automatica";
    }
    await repo.marcarParceladaAvisada(parcelada.id);
    await avisarCompra(pessoaId, m, `${parcelada.nome} (${parcelada.totalParcelas}x)`, parcelada.valorTotal, ctx.agora);
    return "revisar";
  }

  const manual = compraManualCorrespondente({ valor: m.valor, data: m.data, parcelada: null }, ctx.compras, ctx.ligadas, ctx.cartao ? 3 : 1);
  if (manual) {
    ctx.ligadas.add(manual.id);
    await repo.mudarMovimento(pessoaId, m.id, { situacao: "registrada", compraId: manual.id });
    return "registrada";
  }
  if (!ctx.naJanela || ctx.modo === "desligado") return "historico";
  if (ctx.modo === "automatico") {
    const compra = await repo.registrarCompra(
      pessoaId,
      { item: nomeDaLoja(m.descricao), categoria, valor: m.valor, emocao: null, necessidade: null, via: "banco" },
      new Date(`${m.data}T12:00:00-03:00`),
    );
    await repo.mudarMovimento(pessoaId, m.id, { situacao: "automatica", compraId: compra.id });
    return "automatica";
  }
  await avisarCompra(pessoaId, m, nomeDaLoja(m.descricao), m.valor, ctx.agora);
  return "revisar";
}

/** "IFOOD *RESTAURANTE X" → "Ifood *restaurante x": legível sem inventar nome. */
function nomeDaLoja(descricao: string): string {
  const t = descricao.trim().toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

async function avisarCompra(pessoaId: string, m: Movimento, item: string, valor: number, agora: Date): Promise<void> {
  await repo.mudarMovimento(pessoaId, m.id, { situacao: "revisar" });
  await repo.avisarDoMovimento(pessoaId, m.id, "compra-banco", avisoDeCompraDoBanco(item, valor), agora);
  await repo.mensagemDaLuana(pessoaId, mensagemDeCompraDoBanco(item, valor), agora);
}

/**
 * Fatura vencida (até 60 dias) que não foi paga inteira: a diferença está no
 * rotativo. Faturas antigas (o sandbox devolve de 2023) são ignoradas.
 */
async function rotativoDoCartao(
  pessoaId: string,
  conta: ContaBancaria,
  banco: string,
  faturas: Awaited<ReturnType<ClientePluggy["faturas"]>>,
  agora: Date,
): Promise<SugestaoDeDivida | null> {
  const hoje = diaEmBrasilia(agora);
  const limite = diaEmBrasilia(new Date(agora.getTime() - 60 * DIA));
  const vencida = faturas
    .map((f) => ({ f, vence: diaEmBrasilia(f.dueDate) }))
    .filter((x) => x.vence < hoje && x.vence >= limite)
    .sort((a, b) => b.vence.localeCompare(a.vence))[0];
  if (!vencida) return null;
  const total = Math.round(vencida.f.totalAmount * 100);
  const fechamento = diaEmBrasilia(vencida.f.billClosingDate ?? vencida.f.dueDate);
  const pago = (await repo.movimentos(pessoaId, { desde: fechamento }))
    .filter((m) => m.contaId === conta.id && m.natureza === "pagamento-fatura")
    .reduce((s, m) => s + m.valor, 0);
  const falta = total - pago;
  if (falta <= 100) return null;
  return aplicarTravas({
    chave: chaveDaDivida({ instituicao: banco, tipo: "cartao", parcelaMinima: 0 }),
    fonte: "pluggy",
    pluggyLoanId: null,
    tipo: "cartao",
    nome: `Rotativo do cartão · ${conta.nome}`,
    instituicao: banco,
    detalhe: "Rotativo do cartão",
    saldo: falta,
    vencido: null,
    taxaMensal: null,
    parcelaMinima: vencida.f.minimumPaymentAmount ? Math.round(vencida.f.minimumPaymentAmount * 100) : 0,
    vencimento: Number(vencida.vence.slice(8, 10)),
    parcelasRestantes: null,
    cet: null,
    temSeguro: null,
    faltaPagarComJuros: null,
    confira: [],
  });
}

const TIPO_DO_LANCAMENTO: Partial<Record<Movimento["natureza"], Lancamento["tipo"]>> = { compra: "compra", juros: "juros", iof: "iof", tarifa: "tarifa" };

/** Fatura aberta do cartão: compras e encargos entre o fechamento anterior e o próximo. */
async function gravarFaturaAberta(pessoaId: string, conta: ContaBancaria, agora: Date): Promise<void> {
  const vencimento = conta.vencimento;
  const mes = (vencimento ?? diaEmBrasilia(agora)).slice(0, 7);
  const fechamento = conta.fechamento ?? diaEmBrasilia(agora);
  const inicio = somarMeses(fechamento, -1);
  const doCartao = (await repo.movimentos(pessoaId, { desde: inicio })).filter((m) => m.contaId === conta.id && m.data > inicio && m.data <= fechamento);
  const lancamentos: Lancamento[] = doCartao
    .filter((m) => TIPO_DO_LANCAMENTO[m.natureza])
    .map((m) => ({
      id: m.id,
      data: m.data,
      descricao: m.descricao,
      valor: m.valor,
      tipo: TIPO_DO_LANCAMENTO[m.natureza]!,
      ...(m.categoria ? { categoria: m.categoria } : {}),
      compraId: m.compraId,
      ...(m.parcela && m.totalParcelas ? { parcela: m.parcela, totalParcelas: m.totalParcelas } : {}),
    }));

  const chave = `aberta:${conta.id}:${mes}`;
  const anterior = await repo.faturaPorChave(pessoaId, chave);
  const doPdf = (await repo.faturasDoCartao(pessoaId, conta.id, mes)).find((f) => f.fonte === "documento");
  let fatura: Fatura = {
    id: chave,
    tipo: "fatura",
    origem: conta.nome,
    mes,
    lancamentos,
    fonte: "pluggy",
    contaId: conta.id,
    vencimento,
    total: conta.saldo,
    pagamentoMinimo: anterior?.pagamentoMinimo ?? null,
    taxaRotativoMensal: anterior?.taxaRotativoMensal ?? null,
  };
  if (doPdf) {
    const junta = fundirFaturas(fatura, { ...repo.paraFatura(doPdf) });
    fatura = junta.pluggy;
    if (!doPdf.foraDosCalculos) await repo.atualizarFatura(doPdf.id, { foraDosCalculos: true });
  }
  if (anterior) await repo.apagarFatura(anterior.id);
  await repo.salvarFatura(pessoaId, fatura);
}

