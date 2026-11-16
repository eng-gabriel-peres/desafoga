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

  it("apagar a conta apaga tudo da pessoa (LGPD)", async () => {
    const hugo = await criar({ tipo: "pessoa", nome: "Hugo Teste", apelido: "Hugo", idade: null });
    await chamar("compras.registrar", [hugo.pessoa!.id, { item: "Café", categoria: "Mercado", valor: 500, emocao: 4, necessidade: "sim", via: "app" }], hugo);
    await chamar("sessao.apagarConta", [], hugo);
    const { prisma } = await import("./prisma");
    expect(await prisma().pessoa.count({ where: { id: hugo.pessoa!.id } })).toBe(0);
    expect(await prisma().compra.count({ where: { pessoaId: hugo.pessoa!.id } })).toBe(0);
  });
});
