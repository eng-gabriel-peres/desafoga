import { beforeEach, describe, expect, it } from "vitest";
import { criarCodigoDeConexao } from "./link-de-conexao";
import { executar, type Contexto } from "./rotas";
import {
  cancelarPedido,
  conectarPorLink,
  confirmarCodigo,
  desconectar,
  donoDoTelefone,
  pedirCodigo,
  registrarContato,
  telefonesEmMemoria,
  usarTelefones,
} from "./vinculo-whatsapp";
import { atenderNoWhatsapp } from "./whatsapp";

// Sem DATABASE_URL nos testes: registros e números ficam em memória.
beforeEach(() => usarTelefones(telefonesEmMemoria()));

const outroCodigo = (c: string) => (c === "000000" ? "111111" : "000000");
const de = (pessoaId: string, rede: string | null = null) => ({ pessoaId, rede });

/** O número já escreveu para a Luana antes de pedir o código. */
async function pedir(pessoaId: string, numero: string, agora = Date.now(), rede: string | null = null) {
  await registrarContato(numero);
  return pedirCodigo(de(pessoaId, rede), numero, { agora });
}

describe("conectar o WhatsApp com código", () => {
  it("só liga o número depois que a pessoa digita o código recebido", async () => {
    const pedido = await pedir("pessoa-a", "(11) 98888-7777");
    expect(pedido?.telefone).toBe("5511988887777");
    expect(await donoDoTelefone("5511988887777")).toBeNull();
    await expect(confirmarCodigo(de("pessoa-a"), outroCodigo(pedido!.codigo))).rejects.toThrow("não confere");
    expect(await donoDoTelefone("5511988887777")).toBeNull();
    expect(await confirmarCodigo(de("pessoa-a"), pedido!.codigo)).toBe("5511988887777");
    expect(await donoDoTelefone("5511988887777")).toBe("pessoa-a");
  });

  it("o código de uma pessoa não serve para outra", async () => {
    const pedido = await pedir("pessoa-f", "11955554444");
    await expect(confirmarCodigo(de("pessoa-g"), pedido!.codigo)).rejects.toThrow("venceu");
    expect(await donoDoTelefone("5511955554444")).toBeNull();
  });

  it("o código vence, vale uma vez e trava depois de 5 erros", async () => {
    const a = await pedir("pessoa-b", "11977776666");
    await expect(confirmarCodigo(de("pessoa-b"), a!.codigo, { agora: Date.now() + 16 * 60_000 })).rejects.toThrow("venceu");
    expect(await confirmarCodigo(de("pessoa-b"), a!.codigo)).toBe("5511977776666");
    await expect(confirmarCodigo(de("pessoa-b"), a!.codigo)).rejects.toThrow("venceu");

    const b = await pedir("pessoa-b2", "11944443333");
    for (let i = 0; i < 5; i++) await expect(confirmarCodigo(de("pessoa-b2"), outroCodigo(b!.codigo))).rejects.toThrow("não confere");
    await expect(confirmarCodigo(de("pessoa-b2"), b!.codigo)).rejects.toThrow("muitas vezes");
  });

  it("tentativas em paralelo não escapam do limite", async () => {
    const p = await pedir("pessoa-j", "11922221111");
    const errado = outroCodigo(p!.codigo);
    const resultados = await Promise.allSettled(Array.from({ length: 12 }, () => confirmarCodigo(de("pessoa-j"), errado)));
    expect(resultados.filter((r) => r.status === "rejected" && String(r.reason).includes("não confere")).length).toBeLessThanOrEqual(5);
  });

  it("pedir código novo não zera as tentativas do dia", async () => {
    let total = 0;
    let rodadas = 0;
    for (let rodada = 0; rodada < 3; rodada++) {
      const p = await pedir("pessoa-k", "11911110000", Date.now() + rodada * 61_000).catch(() => null);
      if (!p) break;
      rodadas++;
      for (let i = 0; i < 5; i++) {
        const r = await confirmarCodigo(de("pessoa-k"), outroCodigo(p.codigo)).catch((e: Error) => e.message);
        if (String(r).includes("não confere")) total++;
      }
    }
    expect(rodadas).toBe(3);
    expect(total).toBeLessThanOrEqual(10);
  });

  it("trocar de conta não escapa do limite da rede", async () => {
    let total = 0;
    for (let i = 0; i < 20; i++) {
      const p = await pedir(`conta-falsa-${i}`, "11977770000", Date.now(), "rede-1").catch(() => null);
      if (!p) continue;
      const r = await confirmarCodigo(de(`conta-falsa-${i}`, "rede-1"), outroCodigo(p.codigo)).catch((e: Error) => e.message);
      if (String(r).includes("não confere")) total++;
    }
    expect(total).toBeLessThanOrEqual(5);
  });

  it("outra pessoa que erra o código não trava o dono do número", async () => {
    for (let rodada = 0; rodada < 2; rodada++) {
      const p = await pedir("atacante", "11988880000", Date.now() + rodada * 61_000, "rede-atacante");
      for (let i = 0; i < 6; i++) await confirmarCodigo(de("atacante", "rede-atacante"), outroCodigo(p!.codigo)).catch(() => {});
    }
    const meu = await pedir("dono", "11988880000", Date.now(), "rede-dono");
    expect(await confirmarCodigo(de("dono", "rede-dono"), meu!.codigo)).toBe("5511988880000");
  });

  it("só manda código para quem falou com a Luana no WhatsApp", async () => {
    await expect(pedirCodigo(de("pessoa-l"), "11900009999")).rejects.toThrow("oi");
    await registrarContato("5511900009999");
    expect(await pedirCodigo(de("pessoa-l"), "11900009999")).not.toBeNull();
  });

  it("limita códigos por quem pede sem deixar outra pessoa travar o número", async () => {
    await pedir("pessoa-h", "11933332222");
    await expect(pedir("pessoa-h", "11933332222")).rejects.toThrow("Espere um minuto");
    expect(await pedir("pessoa-i", "11933332222")).not.toBeNull();
    const vezes = [];
    for (let i = 1; i <= 7; i++) vezes.push(await pedir("pessoa-h", "11933332222", Date.now() + i * 61_000).then(() => "ok", (e: Error) => e.message));
    expect(vezes.filter((v) => v === "ok").length).toBe(4);
    expect(vezes.at(-1)).toContain("demais hoje");
    expect(await pedir("dono-2", "11933332222")).not.toBeNull();
  });

  it("envio que falhou devolve a vaga do limite", async () => {
    for (let i = 0; i < 8; i++) {
      const p = await pedir("pessoa-m", "11922220000", Date.now() + i * 61_000);
      expect(p).not.toBeNull();
      await cancelarPedido("pessoa-m", p!);
    }
  });

  it("quem confirma depois fica com o número, e desconectar solta", async () => {
    const a = await pedir("pessoa-c", "11966665555");
    await confirmarCodigo(de("pessoa-c"), a!.codigo);
    const b = await pedir("pessoa-d", "11966665555", Date.now() + 61_000);
    await confirmarCodigo(de("pessoa-d"), b!.codigo);
    expect(await donoDoTelefone("5511966665555")).toBe("pessoa-d");
    await desconectar("pessoa-d");
    expect(await donoDoTelefone("5511966665555")).toBeNull();
  });
});

describe("conectar pelo link assinado", () => {
  it("liga o número uma vez só e recusa link adulterado ou vencido", async () => {
    const codigo = criarCodigoDeConexao("5511987650000")!;
    expect(await conectarPorLink("pessoa-link", codigo)).toBe("5511987650000");
    expect(await donoDoTelefone("5511987650000")).toBe("pessoa-link");
    await expect(conectarPorLink("pessoa-outra", codigo)).rejects.toThrow("já foi usado");

    const [, assinatura] = criarCodigoDeConexao("5511987650001")!.split(".");
    const outroNumero = Buffer.from(JSON.stringify({ t: "5511900000000", e: Date.now() + 60_000, n: "x" })).toString("base64url");
    await expect(conectarPorLink("pessoa-link", `${outroNumero}.${assinatura}`)).rejects.toThrow("não é válido");

    const vencido = criarCodigoDeConexao("5511987650002", Date.now() - 31 * 60_000)!;
    await expect(conectarPorLink("pessoa-link", vencido)).rejects.toThrow("venceu");
  });
});

describe("WhatsApp de quem não tem conta", () => {
  it("avisa que o número não está conectado e manda o link de cadastro e o de conexão", async () => {
    const [resposta] = await atenderNoWhatsapp({ de: "5511912341234", tipo: "text", texto: "comprei pão 12" }, "https://desafoga.app", async () => {});
    expect(resposta).toContain("não está conectado a nenhuma conta");
    expect(resposta).toContain("https://desafoga.app");
    expect(resposta).toMatch(/https:\/\/desafoga\.app\/app\/conectar#[\w-]+\.[\w-]+/);
  });
});

describe("API", () => {
  const ctx: Contexto = { rede: null, sessao: null, definirSessao: () => {} };

  it("ids fora do formato (como __proto__) são recusados antes de tudo", async () => {
    await expect(executar("dividas.salvarPlano", ["__proto__", { valorMensal: 1 }], ctx)).rejects.toThrow("Argumentos inválidos");
    expect(({} as Record<string, unknown>).plano).toBeUndefined();
  });

  it("sem sessão, nada de dados", async () => {
    await expect(executar("compras.listar", ["2d1f0c2e-6a5b-4c3d-9e8f-7a6b5c4d3e2f"], ctx)).rejects.toThrow("Entre no Desafoga");
  });
});
