import { describe, expect, it } from "vitest";
import { novoBanco, pessoa, salvarPlano } from "@/services/nucleo";
import { codigoDaMensagem, comBanco, confirmarTelefone, desvincularTelefone, donoDoTelefone, pedirTelefone } from "./armazem";
import { executar } from "./rotas";

describe("cadastro do WhatsApp com prova de posse", () => {
  it("só liga o número depois que o código chega dele", async () => {
    const pedido = await pedirTelefone("visitante-aaaa", "ana", "(11) 98888-7777");
    expect(pedido?.telefone).toBe("5511988887777");
    expect(await donoDoTelefone("5511988887777")).toBeNull();

    expect(await confirmarTelefone("5511988887777", "000000" === pedido!.codigo ? "111111" : "000000")).toBeNull();
    expect(await donoDoTelefone("5511988887777")).toBeNull();

    expect(await confirmarTelefone("5511988887777", pedido!.codigo)).toEqual({ visitante: "visitante-aaaa", pessoaId: "ana" });
    expect(await donoDoTelefone("5511988887777")).toEqual({ visitante: "visitante-aaaa", pessoaId: "ana" });
    expect(await comBanco("visitante-aaaa", (b) => b.telefones.ana, false)).toBe("5511988887777");
  });

  it("o código vale uma vez e vence", async () => {
    const pedido = await pedirTelefone("visitante-bbbb", "ana", "11977776666");
    expect(await confirmarTelefone("5511977776666", pedido!.codigo, Date.now() + 31 * 60_000)).toBeNull();
    expect(await confirmarTelefone("5511977776666", pedido!.codigo)).not.toBeNull();
    expect(await confirmarTelefone("5511977776666", pedido!.codigo)).toBeNull();
  });

  it("outro navegador não apaga a ligação de quem confirmou", async () => {
    const pedido = await pedirTelefone("visitante-cccc", "ana", "11966665555");
    await confirmarTelefone("5511966665555", pedido!.codigo);
    // Outro visitante pede o mesmo número, não confirma e desconecta.
    await pedirTelefone("visitante-dddd", "ana", "11966665555");
    await comBanco("visitante-dddd", (b) => void (b.telefones.ana = "5511966665555"));
    await desvincularTelefone("visitante-dddd", "ana");
    expect(await donoDoTelefone("5511966665555")).toEqual({ visitante: "visitante-cccc", pessoaId: "ana" });
  });

  it("reconhece a mensagem com o código", () => {
    expect(codigoDaMensagem("DESAFOGA 123456")).toBe("123456");
    expect(codigoDaMensagem(" desafoga123456 ")).toBe("123456");
    expect(codigoDaMensagem("desafoga 12345")).toBeNull();
  });
});

describe("ids de pessoa", () => {
  it("__proto__ não chega ao protótipo", async () => {
    const banco = novoBanco();
    expect(() => pessoa(banco, "__proto__")).toThrow("Pessoa não encontrada");
    expect(() => salvarPlano(banco, "constructor", { valorMensal: 1 })).toThrow();
    await expect(executar("dividas.salvarPlano", "visitante-eeee", ["__proto__", { valorMensal: 1 }])).rejects.toThrow("Argumentos inválidos");
    expect(({} as Record<string, unknown>).plano).toBeUndefined();
  });
});
