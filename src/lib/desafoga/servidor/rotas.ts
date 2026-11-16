/**
 * Ações da API do Desafoga (POST /api/desafoga/<acao>). Cada ação valida os
 * argumentos e opera sobre os dados do visitante. Os nomes seguem os
 * contratos de `services/contratos.ts`.
 */
import { z } from "zod";
import { PROFISSIONAIS } from "@/fixtures/desafoga";
import { montarContexto } from "@/lib/assistente/contexto";
import {
  anotar,
  apagarAnotacao,
  avisosDe,
  contextoDoAssistente,
  pessoa,
  registrarCompra,
  responsavel,
  salvarFatura,
  salvarMemoria,
  salvarPlano,
  sugerirValor,
} from "@/services/nucleo";
import type { Fatura } from "@/services/tipos";
import { responderTexto, testarResposta } from "./acoes";
import { cancelarPedido, comBanco, confirmarTelefone, desvincularTelefone, PedidoRecusado, pedirTelefone, recomecarBanco } from "./armazem";
import { enviarPeloWhatsapp, whatsappConfigurado } from "./enviar";

/** Ids só com letras minúsculas, números e hífen: nada de "__proto__" e afins. */
const id = z.string().regex(/^[a-z0-9-]{1,40}$/);
const centavos = z.number().int().min(0).max(1e10);
const emocao = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]);
const necessidade = z.enum(["sim", "nao", "talvez"]);
const categoria = z.enum(["Mercado", "Roupa", "Comida pronta", "Farmácia", "Casa", "Lazer", "Presente", "Outro"]);
const texto = (max: number) => z.string().trim().min(1).max(max);

const lancamento = z.object({
  id: z.string().max(80),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  descricao: z.string().max(200),
  valor: centavos,
  tipo: z.enum(["compra", "juros", "iof", "tarifa", "assinatura", "pagamento"]),
  categoria: categoria.optional(),
  compraId: z.string().max(80).nullable().optional(),
});
const fatura = z.object({
  id: z.string().max(80),
  tipo: z.enum(["fatura", "extrato"]),
  origem: z.string().max(120),
  mes: z.string().regex(/^\d{4}-\d{2}$/),
  lancamentos: z.array(lancamento).max(500),
});

export class ErroDeEntrada extends Error {}

/** Cada ação: esquema dos argumentos e o que fazer com eles. */
const ACOES = {
  "pessoas.listar": acao(z.tuple([]), (v) => comBanco(v, (b) => Object.values(b.pessoas).map((d) => d.persona), false)),
  "pessoas.obter": acao(z.tuple([id]), (v, [p]) => comBanco(v, (b) => b.pessoas[p]?.persona ?? null, false)),
  "pessoas.profissionais": acao(z.tuple([]), async () => PROFISSIONAIS),
  "pessoas.responsavel": acao(z.tuple([]), async () => responsavel()),
  "pessoas.whatsapp": acao(z.tuple([id]), (v, [p]) => comBanco(v, (b) => b.telefones[p] ?? null, false)),
  "pessoas.conectarWhatsapp": acao(z.tuple([id, texto(30)]), async (v, [p, tel]) => {
    await comBanco(v, (b) => pessoa(b, p), false);
    // Desenvolvimento sem WhatsApp configurado: não há como mandar nem receber, o código aparece na tela.
    const semWhatsapp = !whatsappConfigurado() && process.env.NODE_ENV !== "production";
    const pedido = await pedirTelefone(v, p, tel, { exigirContato: !semWhatsapp });
    if (!pedido) throw new ErroDeEntrada("Número inválido. Use DDD e número, por exemplo (11) 99999-8888.");
    const mensagem = `Seu código do Desafoga é ${pedido.codigo}. Digite no app para conectar este WhatsApp. Se não foi você, ignore esta mensagem.`;
    if (semWhatsapp) {
      return { telefone: pedido.telefone, codigoDeTeste: pedido.codigo };
    }
    try {
      await enviarPeloWhatsapp(pedido.telefone, mensagem);
    } catch (e) {
      await cancelarPedido(v, p, pedido.telefone);
      console.error("Desafoga: código não enviado,", e instanceof Error ? e.message.slice(0, 200) : "erro");
      throw new ErroDeEntrada(
        "Não consegui mandar o código para esse WhatsApp. Confira o número e mande antes um “oi” para a Luana por ele (no sandbox da Twilio, a mensagem de entrada “join”).",
      );
    }
    return { telefone: pedido.telefone, codigoDeTeste: null };
  }, "texto"),
  "pessoas.confirmarWhatsapp": acao(z.tuple([id, z.string().regex(/^\s*\d{6}\s*$/)]), async (v, [p, codigo]) => {
    try {
      return await confirmarTelefone(v, p, codigo);
    } catch (e) {
      if (e instanceof PedidoRecusado) throw new ErroDeEntrada(e.message);
      throw e;
    }
  }, "codigo"),
  "pessoas.desconectarWhatsapp": acao(z.tuple([id]), (v, [p]) => desvincularTelefone(v, p)),

  "compras.listar": acao(z.tuple([id]), (v, [p]) => comBanco(v, (b) => pessoa(b, p).compras, false)),
  "compras.registrar": acao(
    z.tuple([id, z.object({ item: texto(80), categoria, valor: centavos.min(1), emocao, necessidade, via: z.enum(["app", "whatsapp", "fatura"]) })]),
    (v, [p, nova]) => comBanco(v, (b) => registrarCompra(b, p, nova)),
  ),

  "dividas.listar": acao(z.tuple([id]), (v, [p]) => comBanco(v, (b) => pessoa(b, p).dividas, false)),
  "dividas.plano": acao(z.tuple([id]), (v, [p]) => comBanco(v, (b) => pessoa(b, p).plano, false)),
  "dividas.salvarPlano": acao(
    z.tuple([id, z.object({ valorMensal: centavos.optional(), estrategia: z.enum(["mais-cara", "menor"]).optional() })]),
    (v, [p, m]) => comBanco(v, (b) => salvarPlano(b, p, m)),
  ),
  "dividas.sugerirValor": acao(z.tuple([id, centavos.min(1)]), (v, [p, valor]) => comBanco(v, (b) => sugerirValor(b, p, valor))),

  "faturas.listar": acao(z.tuple([id]), (v, [p]) => comBanco(v, (b) => pessoa(b, p).faturas, false)),
  "faturas.salvar": acao(
    z.tuple([id, fatura, z.record(z.string(), z.object({ emocao: emocao.optional(), necessidade: necessidade.optional() }))]),
    (v, [p, f, c]) => comBanco(v, (b) => salvarFatura(b, p, f as Fatura, c)),
  ),

  "memoria.obter": acao(z.tuple([id]), (v, [p]) => comBanco(v, (b) => pessoa(b, p).memoria, false)),
  "memoria.salvar": acao(
    z.tuple([
      id,
      z.object({
        caracteristicas: z.array(texto(80)).max(40).optional(),
        tom: z.enum(["acolhedor", "direto", "motivador"]).optional(),
        objetivo: z.string().max(300).optional(),
        evitar: z.string().max(600).optional(),
      }),
    ]),
    (v, [p, m]) => comBanco(v, (b) => salvarMemoria(b, p, m)),
  ),
  "memoria.anotar": acao(
    z.tuple([id, z.object({ autorId: id, texto: texto(2000), privada: z.boolean() })]),
    (v, [p, n]) => comBanco(v, (b) => anotar(b, p, n)),
  ),
  "memoria.apagarAnotacao": acao(z.tuple([id, z.string().max(80)]), (v, [p, n]) => comBanco(v, (b) => apagarAnotacao(b, p, n))),

  "assistente.conversa": acao(z.tuple([id]), (v, [p]) => comBanco(v, (b) => pessoa(b, p).conversa, false)),
  "assistente.enviar": acao(z.tuple([id, texto(1000)]), (v, [p, t]) => responderTexto(v, p, "app", t), "texto"),
  "assistente.testar": acao(z.tuple([id, texto(1000)]), (v, [p, t]) => testarResposta(v, p, t), "texto"),
  "assistente.contexto": acao(z.tuple([id]), (v, [p]) => comBanco(v, (b) => montarContexto(contextoDoAssistente(b, p, "app")), false)),

  "avisos.listar": acao(z.tuple([id.optional()]), (v, [p]) => comBanco(v, (b) => avisosDe(b, p), false)),
  recomecar: acao(z.tuple([]), (v) => recomecarBanco(v)),
};

type Recurso = "texto" | "arquivo" | "audio" | "codigo";

function acao<A extends z.ZodTypeAny, R>(
  argumentos: A,
  executar: (visitante: string, args: z.infer<A>) => Promise<R>,
  /** Ações que chamam a IA entram no limite diário de uso. */
  recurso?: Recurso,
) {
  return { argumentos, executar, recurso };
}

export type NomeDaAcao = keyof typeof ACOES;

export function acaoExiste(nome: string): nome is NomeDaAcao {
  return Object.hasOwn(ACOES, nome);
}

export function recursoDa(nome: NomeDaAcao): Recurso | undefined {
  return ACOES[nome].recurso;
}

/** Valida os argumentos e executa a ação. */
export async function executar(nome: NomeDaAcao, visitante: string, args: unknown): Promise<unknown> {
  const a = ACOES[nome];
  const lidos = a.argumentos.safeParse(Array.isArray(args) ? args : []);
  if (!lidos.success) throw new ErroDeEntrada("Argumentos inválidos.");
  return (a.executar as (v: string, args: unknown) => Promise<unknown>)(visitante, lidos.data);
}
