import { describe, expect, it } from "vitest";
import { type Contador, contadorEmMemoria, criarLimitador, FOLGA_POR_REDE, LIMITE_POR_VISITANTE, redeDe } from "./limite";

async function repetir(vezes: number, acao: () => Promise<unknown>) {
  for (let i = 0; i < vezes; i++) await acao();
}

describe("limite de uso", () => {
  it("atende até o limite do visitante e recusa o pedido seguinte", async () => {
    const consumir = criarLimitador(contadorEmMemoria());
    const limite = LIMITE_POR_VISITANTE.arquivo;
    await repetir(limite - 1, () => consumir("arquivo", "ana", null));
    expect(await consumir("arquivo", "ana", null)).toEqual({ permitido: true });
    const recusado = await consumir("arquivo", "ana", null);
    expect(recusado.permitido).toBe(false);
    expect(recusado.mensagem).toContain(`limite de hoje (${limite} arquivos)`);
  });

  it("conta cada visitante e cada tipo de pedido em separado", async () => {
    const consumir = criarLimitador(contadorEmMemoria());
    await repetir(LIMITE_POR_VISITANTE.audio + 1, () => consumir("audio", "ana", null));
    expect((await consumir("audio", "ana", null)).permitido).toBe(false);
    expect((await consumir("audio", "bia", null)).permitido).toBe(true);
    expect((await consumir("texto", "ana", null)).permitido).toBe(true);
  });

  it("segura uma rede que troca de identificador a cada pedido", async () => {
    const consumir = criarLimitador(contadorEmMemoria());
    const teto = LIMITE_POR_VISITANTE.audio * FOLGA_POR_REDE;
    let n = 0;
    await repetir(teto, () => consumir("audio", `visitante-${n++}`, "203.0.113.7"));
    const recusado = await consumir("audio", `visitante-${n++}`, "203.0.113.7");
    expect(recusado.permitido).toBe(false);
    expect(recusado.mensagem).toContain("da sua rede");
    expect((await consumir("audio", "outra-pessoa", "198.51.100.2")).permitido).toBe(true);
  });

  it("para o site inteiro no teto global", async () => {
    const consumir = criarLimitador(contadorEmMemoria(), 5);
    let n = 0;
    await repetir(5, () => consumir("texto", `v${n++}`, null));
    expect((await consumir("texto", "mais-um", null)).mensagem).toContain("limite de atendimentos de hoje");
  });

  it("atende quando a contagem falha", async () => {
    const quebrado: Contador = async () => {
      throw new Error("banco fora do ar");
    };
    const consumir = criarLimitador(quebrado);
    expect(await consumir("texto", "ana", null)).toEqual({ permitido: true });
  });

  it("lê as contagens do dia sem somar", async () => {
    const contar = contadorEmMemoria();
    await contar(["v:texto:ana", "global", "ia:ok:modelo-a"], "2026-11-12");
    await contar(["ia:sem_cota:modelo-b"], "2026-11-12");
    await contar(["global"], "2026-11-11");
    const lidas = await contar.ler?.("2026-11-12", ["global", "v:texto:ana"], "ia:");
    expect(Object.fromEntries(lidas ?? [])).toEqual({
      "v:texto:ana": 1,
      global: 1,
      "ia:ok:modelo-a": 1,
      "ia:sem_cota:modelo-b": 1,
    });
  });

  it("identifica a rede pelo primeiro endereço, sem guardar o endereço", () => {
    const rede = redeDe(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }));
    expect(rede).toMatch(/^[0-9a-f]{16}$/);
    expect(rede).toBe(redeDe(new Headers({ "x-forwarded-for": "203.0.113.7" })));
    expect(rede).not.toBe(redeDe(new Headers({ "x-forwarded-for": "203.0.113.8" })));
    expect(redeDe(new Headers())).toBeNull();
  });
});
