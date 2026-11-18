/**
 * O agendador no Postgres de teste: manda cada mensagem uma vez só, no chat do
 * app e (se der) no WhatsApp, e não mexe na demo. Roda só com TEST_DATABASE_URL.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.TEST_DATABASE_URL;

describe.runIf(url)("agendador", () => {
  let prisma: typeof import("./prisma").prisma;
  let rodarAgendador: typeof import("./agendador").rodarAgendador;

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    prisma = (await import("./prisma")).prisma;
    rodarAgendador = (await import("./agendador")).rodarAgendador;
  });

  afterAll(async () => {
    await prisma().$disconnect();
  });

  /** Quarta, 18/11/2026, 09:10 em Brasília: hora do check-in da manhã e do lembrete da conta. */
  const agora = new Date("2026-11-18T09:10:00-03:00");

  async function pessoa(tipo: "REAL" | "DEMO", telefone: string | null = null) {
    const espaco = await prisma().espaco.create({ data: { tipo } });
    const p = await prisma().pessoa.create({ data: { espacoId: espaco.id, nome: "Bia", apelido: "Bia", cor: "azul", telefone } });
    await prisma().rotina.create({ data: { pessoaId: p.id, horarioManha: "09:00", manhaLigado: true, tardeLigado: false, noiteLigado: false } });
    await prisma().contaFixa.create({ data: { pessoaId: p.id, nome: "Internet", categoria: "internet", valor: 10000, vencimento: 19, lembrete: true } });
    return p.id;
  }

  const mensagens = (pessoaId: string) => prisma().mensagem.findMany({ where: { pessoaId, de: "assistente" }, orderBy: { quando: "asc" } });

  it("manda o check-in e a conta de amanhã no chat, uma vez só", async () => {
    const p = await pessoa("REAL");
    const r = await rodarAgendador({ agora, pessoas: [p], whatsapp: async () => {} });
    expect(r.enviados).toBe(2);
    const textos = (await mensagens(p)).map((m) => m.texto);
    expect(textos).toEqual([expect.stringMatching(/Bom dia, Bia/), expect.stringMatching(/Internet vence amanhã/)]);
    // O GitHub chama de novo 15 minutos depois: nada repetido.
    const de_novo = await rodarAgendador({ agora: new Date(agora.getTime() + 15 * 60_000), pessoas: [p], whatsapp: async () => {} });
    expect(de_novo.enviados).toBe(0);
    expect(await mensagens(p)).toHaveLength(2);
    // Respondendo pelo app, a pergunta da manhã não se repete no chat; a da tarde não foi feita.
    const { checkInJaPerguntado } = await import("./agendador");
    expect(await checkInJaPerguntado(p, "manha", agora)).toBe(true);
    expect(await checkInJaPerguntado(p, "tarde", agora)).toBe(false);
  });

  it("tenta o WhatsApp de quem confirmou o número; se falhar, a mensagem fica no app", async () => {
    const p = await pessoa("REAL", `55119${Date.now().toString().slice(-8)}`);
    const enviados: string[] = [];
    const r = await rodarAgendador({
      agora,
      pessoas: [p],
      whatsapp: async (_numero, texto) => {
        if (texto.includes("Internet")) throw new Error("fora da janela de 24 horas");
        enviados.push(texto);
      },
    });
    expect(enviados).toEqual([expect.stringMatching(/Bom dia/)]);
    expect(r).toMatchObject({ enviados: 2, whatsapp: 1 });
    expect(await mensagens(p)).toHaveLength(2);
  });

  it("confere as conquistas que avançam só com o tempo (dias sem compra por impulso)", async () => {
    const p = await pessoa("REAL");
    await prisma().conquista.create({
      data: { pessoaId: p, icone: "broto", titulo: "1 dia sem compra por impulso", tipo: "sem-impulso", alvo: 1, criadaEm: new Date(agora.getTime() - 86_400_000) },
    });
    await rodarAgendador({ agora, pessoas: [p], whatsapp: async () => {} });
    expect((await prisma().conquista.findFirstOrThrow({ where: { pessoaId: p } })).concluidaEm).not.toBeNull();
    expect((await mensagens(p)).some((m) => m.texto.includes("Conquista desbloqueada"))).toBe(true);
  });

  it("não manda nada para a demo", async () => {
    const p = await pessoa("DEMO");
    const r = await rodarAgendador({ agora, pessoas: [p], whatsapp: async () => {} });
    expect(r.enviados).toBe(0);
    expect(await mensagens(p)).toHaveLength(0);
  });
});
