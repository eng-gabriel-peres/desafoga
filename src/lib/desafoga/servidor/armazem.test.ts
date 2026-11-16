import { describe, expect, it } from "vitest";
import { novoBanco, pessoa, salvarPlano } from "@/services/nucleo";
import {
  comBanco,
  confirmarTelefone,
  desvincularTelefone,
  donoDoTelefone,
  pedirTelefone as pedirComContato,
  registrarContato,
  registrarEnvio,
} from "./armazem";
import { executar } from "./rotas";
import { atenderNoWhatsapp } from "./whatsapp";

const outroCodigo = (c: string) => (c === "000000" ? "111111" : "000000");

/** Nos testes, o número já escreveu para a Luana antes de pedir o código. */
async function pedirTelefone(visitante: string, pessoaId: string, numero: string, agora = Date.now()) {
  await registrarContato(numero);
  const pedido = await pedirComContato(visitante, pessoaId, numero, { agora });
  if (pedido) await registrarEnvio(visitante, pedido.telefone, agora);
  return pedido;
}

describe("conectar o WhatsApp com código", () => {
  it("só liga o número depois que a pessoa digita o código recebido", async () => {
    const pedido = await pedirTelefone("visitante-aaaa", "ana", "(11) 98888-7777");
    expect(pedido?.telefone).toBe("5511988887777");
    expect(await donoDoTelefone("5511988887777")).toBeNull();

    await expect(confirmarTelefone("visitante-aaaa", "ana", outroCodigo(pedido!.codigo))).rejects.toThrow("não confere");
    expect(await donoDoTelefone("5511988887777")).toBeNull();

    expect(await confirmarTelefone("visitante-aaaa", "ana", pedido!.codigo)).toBe("5511988887777");
    expect(await donoDoTelefone("5511988887777")).toEqual({ visitante: "visitante-aaaa", pessoaId: "ana" });
    expect(await comBanco("visitante-aaaa", (b) => b.telefones.ana, false)).toBe("5511988887777");
  });

  it("o código de um navegador não serve em outro", async () => {
    const pedido = await pedirTelefone("visitante-ffff", "ana", "11955554444");
    await expect(confirmarTelefone("visitante-gggg", "ana", pedido!.codigo)).rejects.toThrow("venceu");
    expect(await donoDoTelefone("5511955554444")).toBeNull();
  });

  it("o código vence, vale uma vez e trava depois de 5 erros", async () => {
    const a = await pedirTelefone("visitante-bbbb", "ana", "11977776666");
    await expect(confirmarTelefone("visitante-bbbb", "ana", a!.codigo, Date.now() + 16 * 60_000)).rejects.toThrow("venceu");
    expect(await confirmarTelefone("visitante-bbbb", "ana", a!.codigo)).toBe("5511977776666");
    await expect(confirmarTelefone("visitante-bbbb", "ana", a!.codigo)).rejects.toThrow("venceu");

    const b = await pedirTelefone("visitante-bbbb", "carlos", "11944443333");
    for (let i = 0; i < 5; i++) await expect(confirmarTelefone("visitante-bbbb", "carlos", outroCodigo(b!.codigo))).rejects.toThrow("não confere");
    await expect(confirmarTelefone("visitante-bbbb", "carlos", b!.codigo)).rejects.toThrow("muitas vezes");
  });

  it("tentativas em paralelo não escapam do limite", async () => {
    const p = await pedirTelefone("visitante-jjjj", "ana", "11922221111");
    const errado = outroCodigo(p!.codigo);
    const resultados = await Promise.allSettled(Array.from({ length: 12 }, () => confirmarTelefone("visitante-jjjj", "ana", errado)));
    const naoConfere = resultados.filter((r) => r.status === "rejected" && String(r.reason).includes("não confere"));
    expect(naoConfere.length).toBeLessThanOrEqual(5);
  });

  it("pedir código novo não zera as tentativas do navegador no dia", async () => {
    let total = 0;
    for (let rodada = 0; rodada < 3; rodada++) {
      const p = await pedirTelefone("visitante-kkkk", "ana", "11911110000", Date.now() + rodada * 61_000).catch(() => null);
      if (!p) break;
      for (let i = 0; i < 5; i++) {
        const r = await confirmarTelefone("visitante-kkkk", "ana", outroCodigo(p.codigo)).catch((e: Error) => e.message);
        if (String(r).includes("não confere")) total++;
      }
    }
    expect(total).toBeLessThanOrEqual(10);
  });

  it("outra sessão que erra o código não trava o dono do número", async () => {
    const numero = "11988880000";
    for (let rodada = 0; rodada < 2; rodada++) {
      const p = await pedirTelefone("visitante-atacante", "ana", numero, Date.now() + rodada * 61_000);
      for (let i = 0; i < 6; i++) await confirmarTelefone("visitante-atacante", "ana", outroCodigo(p!.codigo)).catch(() => {});
    }
    const meu = await pedirTelefone("visitante-dono1", "ana", numero);
    expect(await confirmarTelefone("visitante-dono1", "ana", meu!.codigo)).toBe("5511988880000");
  });

  it("só manda código para quem falou com a Luana no WhatsApp", async () => {
    await expect(pedirComContato("visitante-llll", "ana", "11900009999")).rejects.toThrow("oi");
    await registrarContato("5511900009999");
    expect(await pedirComContato("visitante-llll", "ana", "11900009999")).not.toBeNull();
  });

  it("limita códigos por navegador sem deixar outro navegador travar o número", async () => {
    await pedirTelefone("visitante-hhhh", "ana", "11933332222");
    await expect(pedirTelefone("visitante-hhhh", "ana", "11933332222")).rejects.toThrow("Espere um minuto");
    // Outro navegador não é afetado pelo intervalo de quem pediu antes.
    expect(await pedirTelefone("visitante-iiii", "ana", "11933332222")).not.toBeNull();

    const vezes = [];
    for (let i = 1; i <= 7; i++) {
      vezes.push(await pedirTelefone("visitante-hhhh", "ana", "11933332222", Date.now() + i * 61_000).then(() => "ok", (e: Error) => e.message));
    }
    expect(vezes.filter((v) => v === "ok").length).toBe(4);
    expect(vezes.at(-1)).toContain("demais hoje");
    // O dono, em outro navegador, ainda recebe código.
    expect(await pedirTelefone("visitante-dono2", "ana", "11933332222")).not.toBeNull();
  });

  it("envio que falhou não conta no limite", async () => {
    await registrarContato("11922220000");
    for (let i = 0; i < 8; i++) {
      // Pediu e não registrou o envio (o WhatsApp recusou): o próximo pedido ainda passa.
      expect(await pedirComContato("visitante-mmmm", "ana", "11922220000", { agora: Date.now() + i * 61_000 })).not.toBeNull();
    }
  });

  it("outro navegador não apaga a ligação de quem confirmou", async () => {
    const pedido = await pedirTelefone("visitante-cccc", "ana", "11966665555");
    await confirmarTelefone("visitante-cccc", "ana", pedido!.codigo);
    await comBanco("visitante-dddd", (b) => void (b.telefones.ana = "5511966665555"));
    await desvincularTelefone("visitante-dddd", "ana");
    expect(await donoDoTelefone("5511966665555")).toEqual({ visitante: "visitante-cccc", pessoaId: "ana" });
  });
});

describe("WhatsApp de quem não tem conta", () => {
  it("avisa que o número não está conectado e manda o link de cadastro", async () => {
    const [resposta] = await atenderNoWhatsapp({ de: "5511912341234", tipo: "text", texto: "comprei pão 12" }, "https://desafoga.app", async () => {});
    expect(resposta).toContain("não está conectado a nenhuma conta");
    expect(resposta).toContain("https://desafoga.app");
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
