/**
 * Integração com o Postgres de verdade (banco de teste do Docker, ou o
 * serviço Postgres do CI). Roda só com TEST_DATABASE_URL.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { NovaSessao, SessaoAtual } from "./sessao";
import type { Contexto } from "./rotas";

const url = process.env.TEST_DATABASE_URL;

describe.runIf(url)("Desafoga no Postgres", () => {
  let sessaoDe: (n: NovaSessao) => Promise<SessaoAtual>;
  let chamar: (acao: string, args: unknown[], sessao: SessaoAtual | null) => Promise<{ dados: unknown; nova: NovaSessao | null | undefined }>;

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    const { lerSessao } = await import("./sessao");
    const { executar } = await import("./rotas");
    sessaoDe = async (n) => (await lerSessao(n.token))!;
    chamar = async (acao, args, sessao) => {
      let nova: NovaSessao | null | undefined;
      const ctx: Contexto = { rede: null, sessao, definirSessao: (s) => (nova = s) };
      const dados = await executar(acao as never, args, ctx);
      return { dados, nova };
    };
  });

  afterAll(async () => {
    const { prisma } = await import("./prisma");
    await prisma().$disconnect();
  });

  async function entrar(perfil: string, atual: SessaoAtual | null = null): Promise<SessaoAtual> {
    const { nova } = await chamar("sessao.entrarNaDemo", [perfil], atual);
    return sessaoDe(nova!);
  }

  async function criar(conta: object): Promise<SessaoAtual> {
    const { nova } = await chamar("sessao.criarConta", [conta], null);
    return sessaoDe(nova!);
  }

  it("a demo cria uma cópia dos dados e Ana e Paula veem o mesmo espaço", async () => {
    const ana = await entrar("ana");
    expect(ana.demo).toBe(true);
    expect(ana.pessoa?.apelido).toBe("Ana");
    const { dados: compras } = await chamar("compras.listar", [ana.pessoa!.id], ana);
    expect((compras as unknown[]).length).toBe(13);

    const paula = await entrar("paula", ana);
    expect(paula.espacoId).toBe(ana.espacoId);
    const { dados: pacientes } = await chamar("pessoas.listar", [], paula);
    expect((pacientes as { apelido: string }[]).map((p) => p.apelido).sort()).toEqual(["Ana", "Carlos", "Lúcia", "Rafael"]);
  });

  it("recomeçar a demo apaga o espaço antigo em vez de acumular", async () => {
    const ana = await entrar("ana");
    const { nova } = await chamar("recomecar", [], ana);
    const nova_ = await sessaoDe(nova!);
    expect(nova_.espacoId).not.toBe(ana.espacoId);
    const { prisma } = await import("./prisma");
    expect(await prisma().espaco.count({ where: { id: ana.espacoId } })).toBe(0);
  });

  it("orçamento: a pessoa define o limite; o profissional só lê; outra visita não vê", async () => {
    const ana = await entrar("ana");
    const p = ana.pessoa!.id;
    const { dados: inicial } = await chamar("orcamentos.listar", [p], ana);
    expect((inicial as { categoria: string }[]).map((o) => o.categoria)).toContain("Mercado");
    const { dados: depois } = await chamar("orcamentos.salvar", [p, "Lazer", 15000], ana);
    expect(depois).toContainEqual({ categoria: "Lazer", limite: 15000 });
    const { dados: semMercado } = await chamar("orcamentos.salvar", [p, "Mercado", 0], ana);
    expect((semMercado as { categoria: string }[]).map((o) => o.categoria)).not.toContain("Mercado");

    const paula = await entrar("paula", ana);
    expect(await chamar("orcamentos.listar", [p], paula)).toBeTruthy();
    await expect(chamar("orcamentos.salvar", [p, "Lazer", 1], paula)).rejects.toThrow();
    const estranha = await entrar("paula");
    await expect(chamar("orcamentos.listar", [p], estranha)).rejects.toThrow("não tem acesso");
  });

  it("metas: a transferência pelo app ou pela Luana já conta na meta; concluir avisa quem acompanha", async () => {
    const ana = await entrar("ana");
    const p = ana.pessoa!.id;
    type M = { id: string; nome: string; alvo: number; depositos: { id: string; valor: number; via: string }[] };
    const total = (m: M) => m.depositos.reduce((s, v) => s + v.valor, 0);
    const { dados: metas } = await chamar("metas.listar", [p], ana);
    const reserva = (metas as M[]).find((m) => m.nome === "Reserva de emergência")!;
    expect(total(reserva)).toBe(27000);

    const { dados: pelaTela } = await chamar("metas.guardar", [p, reserva.id, { valor: 20000, descricao: "Transferência da conta" }], ana);
    expect(total(pelaTela as M)).toBe(47000);

    await chamar("assistente.enviar", [p, "Vou transferir 1k da minha conta para a reserva"], ana);
    const { dados: depois } = await chamar("metas.listar", [p], ana);
    const r = (depois as M[]).find((m) => m.id === reserva.id)!;
    expect(total(r)).toBe(147000);
    expect(r.depositos.at(-1)).toMatchObject({ valor: 100000, via: "app" });

    const paula = await entrar("paula", ana);
    const { dados: avisos } = await chamar("avisos.daPessoa", [p], paula);
    expect((avisos as { tipo: string; texto: string }[])[0]).toMatchObject({ tipo: "meta", texto: "Ana completou a meta Reserva de emergência (R$ 1.000)." });

    // Apagar depósito, só a dona; o profissional só incentiva.
    const { dados: semUltimo } = await chamar("metas.apagarDeposito", [p, reserva.id, r.depositos.at(-1)!.id], ana);
    expect(total(semUltimo as M)).toBe(47000);
    await expect(chamar("metas.guardar", [p, reserva.id, { valor: 100, descricao: "" }], paula)).rejects.toThrow();
    expect((await chamar("metas.incentivar", [p, reserva.id], paula)).dados).toEqual({ whatsapp: false });
    const { dados: conversa } = await chamar("assistente.conversa", [p], ana);
    expect((conversa as { texto: string }[]).at(-1)!.texto).toContain("está acompanhando sua meta Reserva de emergência");

    // A meta de outra pessoa não aceita depósito, nem pelo id.
    const outra = await entrar("ana");
    await expect(chamar("metas.guardar", [outra.pessoa!.id, reserva.id, { valor: 100, descricao: "" }], outra)).rejects.toThrow("Meta não encontrada");
  });

  it("cada visita da demo é isolada: a Paula de uma não vê a Ana da outra", async () => {
    const ana1 = await entrar("ana");
    const paula2 = await entrar("paula");
    expect(paula2.espacoId).not.toBe(ana1.espacoId);
    await expect(chamar("compras.listar", [ana1.pessoa!.id], paula2)).rejects.toThrow("não tem acesso");
  });

  it("conta real: a pessoa registra e lê as próprias compras; outra pessoa não", async () => {
    const bia = await criar({ tipo: "pessoa", nome: "Bia Teste", apelido: "Bia", idade: 30 });
    const caio = await criar({ tipo: "pessoa", nome: "Caio Teste", apelido: "Caio", idade: null });
    expect(bia.demo).toBe(false);
    await chamar("compras.registrar", [bia.pessoa!.id, { item: "Pão", categoria: "Mercado", valor: 1200, emocao: 3, necessidade: "sim", via: "app" }], bia);
    const { dados } = await chamar("compras.listar", [bia.pessoa!.id], bia);
    expect((dados as { item: string }[]).map((c) => c.item)).toEqual(["Pão"]);
    await expect(chamar("compras.listar", [bia.pessoa!.id], caio)).rejects.toThrow("não tem acesso");
    await expect(chamar("compras.registrar", [bia.pessoa!.id, { item: "X", categoria: "Outro", valor: 1, emocao: 1, necessidade: "nao", via: "app" }], caio)).rejects.toThrow(
      "seus próprios dados",
    );
  });

  it("o profissional só vê quem aceitou o convite, e anota sempre em nome próprio", async () => {
    const dani = await criar({ tipo: "pessoa", nome: "Dani Teste", apelido: "Dani", idade: null });
    const psi = await criar({ tipo: "profissional", nome: "Dra. Teste", papel: "Psicóloga" });
    await expect(chamar("memoria.obter", [dani.pessoa!.id], psi)).rejects.toThrow("não acompanha");

    await chamar("sessao.aceitarConvite", [psi.profissional!.convite.toLowerCase()], dani);
    const { dados: pacientes } = await chamar("pessoas.listar", [], psi);
    expect((pacientes as { id: string }[]).map((p) => p.id)).toContain(dani.pessoa!.id);

    const { dados: nota } = await chamar("memoria.anotar", [dani.pessoa!.id, { texto: "Primeira conversa.", privada: true }], psi);
    expect((nota as { autorId: string }).autorId).toBe(psi.profissional!.id);
    // Outro profissional que também acompanha não apaga a nota de quem escreveu.
    const eco = await criar({ tipo: "profissional", nome: "Dr. Outro", papel: "Economista" });
    await chamar("sessao.aceitarConvite", [eco.profissional!.convite], dani);
    await expect(chamar("memoria.apagarAnotacao", [dani.pessoa!.id, (nota as { id: string }).id], eco)).rejects.toThrow("Só quem escreveu");
    await chamar("memoria.apagarAnotacao", [dani.pessoa!.id, (nota as { id: string }).id], psi);
    // A pessoa não lê a memória (as notas privadas ficam com quem acompanha).
    await expect(chamar("memoria.obter", [dani.pessoa!.id], dani)).rejects.toThrow("não acompanha");
  });

  it("convite de um espaço não vale em outro (demo e real não se misturam)", async () => {
    const paula = await entrar("paula");
    const real = await criar({ tipo: "pessoa", nome: "Eva Teste", apelido: "Eva", idade: null });
    await expect(chamar("sessao.aceitarConvite", [paula.profissional!.convite], real)).rejects.toThrow("não encontrado");
  });

  it("a conversa com a Luana registra a compra e guarda as mensagens", async () => {
    const fabi = await criar({ tipo: "pessoa", nome: "Fabi Teste", apelido: "Fabi", idade: null });
    const id = fabi.pessoa!.id;
    await chamar("assistente.enviar", [id, "comprei pão 12"], fabi);
    await chamar("assistente.enviar", [id, "3"], fabi);
    const { dados: fim } = await chamar("assistente.enviar", [id, "sim"], fabi);
    expect((fim as { texto: string }[])[0].texto).toContain("Anotado: Pão, R$ 12,00.");
    const { dados: compras } = await chamar("compras.listar", [id], fabi);
    expect((compras as { item: string; via: string }[]).map((c) => [c.item, c.via])).toEqual([["Pão", "app"]]);
    const { dados: conversa } = await chamar("assistente.conversa", [id], fabi);
    expect((conversa as unknown[]).length).toBe(7); // boas-vindas + 3 da pessoa + 3 respostas
  });

  it("fatura não liga lançamento a compra de outra pessoa", async () => {
    const gil = await criar({ tipo: "pessoa", nome: "Gil Teste", apelido: "Gil", idade: null });
    const ana = await entrar("ana");
    const { dados: daAna } = await chamar("compras.listar", [ana.pessoa!.id], ana);
    const alheia = (daAna as { id: string }[])[0].id;
    const fatura = {
      id: "f",
      tipo: "fatura",
      origem: "Teste",
      mes: "2026-11",
      lancamentos: [{ id: "l1", data: "2026-11-10", descricao: "LOJA", valor: 1000, tipo: "compra", compraId: alheia }],
    };
    await chamar("faturas.salvar", [gil.pessoa!.id, fatura, {}], gil);
    const { dados } = await chamar("faturas.listar", [gil.pessoa!.id], gil);
    expect((dados as { lancamentos: { compraId: string | null }[] }[])[0].lancamentos[0].compraId).toBeNull();
  });

  it("a pessoa cadastra, edita e remove as próprias dívidas; outra pessoa não mexe", async () => {
    const ivo = await criar({ tipo: "pessoa", nome: "Ivo Teste", apelido: "Ivo", idade: null });
    const juli = await criar({ tipo: "pessoa", nome: "Juli Teste", apelido: "Juli", idade: null });
    const nova = { tipo: "cartao", nome: "Cartão", detalhe: "", saldo: 150000, taxaMensal: 0.142, parcelaMinima: 25000, vencimento: 10 };
    const { dados: criada } = await chamar("dividas.salvar", [ivo.pessoa!.id, nova], ivo);
    const id = (criada as { id: string }).id;
    await chamar("dividas.salvar", [ivo.pessoa!.id, { ...nova, id, saldo: 120000 }], ivo);
    const { dados: lista } = await chamar("dividas.listar", [ivo.pessoa!.id], ivo);
    expect((lista as { saldo: number }[]).map((d) => d.saldo)).toEqual([120000]);
    // Juli tenta editar a dívida do Ivo dizendo que é dela: não acha.
    await expect(chamar("dividas.salvar", [juli.pessoa!.id, { ...nova, id, saldo: 1 }], juli)).rejects.toThrow("não encontrada");
    await chamar("dividas.remover", [ivo.pessoa!.id, id], ivo);
    expect(((await chamar("dividas.listar", [ivo.pessoa!.id], ivo)).dados as unknown[]).length).toBe(0);
  });

  it("apagar a conta apaga tudo da pessoa (LGPD)", async () => {
    const hugo = await criar({ tipo: "pessoa", nome: "Hugo Teste", apelido: "Hugo", idade: null });
    await chamar("compras.registrar", [hugo.pessoa!.id, { item: "Café", categoria: "Mercado", valor: 500, emocao: 4, necessidade: "sim", via: "app" }], hugo);
    await chamar("sessao.apagarConta", [], hugo);
    const { prisma } = await import("./prisma");
    expect(await prisma().pessoa.count({ where: { id: hugo.pessoa!.id } })).toBe(0);
    expect(await prisma().compra.count({ where: { pessoaId: hugo.pessoa!.id } })).toBe(0);
  });
});
