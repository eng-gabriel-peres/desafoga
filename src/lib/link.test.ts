import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { criarCodigo, lerCodigo, mensagemDoPainel, origemDoSite, pedidoDePainel } from "./link";

const AGORA = Date.UTC(2026, 10, 16, 12, 0, 0);
const MINUTO = 60_000;
const VARIAVEIS = ["PAINEL_LINK_SECRET", "TWILIO_AUTH_TOKEN", "WHATSAPP_APP_SECRET", "VERCEL_ENV", "VERCEL_PROJECT_PRODUCTION_URL"];

let antes: Record<string, string | undefined>;
beforeEach(() => {
  antes = Object.fromEntries(VARIAVEIS.map((v) => [v, process.env[v]]));
  for (const v of VARIAVEIS) delete process.env[v];
  process.env.PAINEL_LINK_SECRET = "segredo-de-teste";
});
afterEach(() => {
  for (const v of VARIAVEIS) {
    if (antes[v] === undefined) delete process.env[v];
    else process.env[v] = antes[v];
  }
});

describe("código do link", () => {
  it("devolve a conta enquanto está no prazo", () => {
    const codigo = criarCodigo("wa:5511999990000", AGORA)!;
    expect(lerCodigo(codigo, AGORA + 29 * MINUTO)).toBe("wa:5511999990000");
  });

  it("deixa de valer depois de 30 minutos", () => {
    const codigo = criarCodigo("wa:5511999990000", AGORA)!;
    expect(lerCodigo(codigo, AGORA + 30 * MINUTO)).toBeNull();
  });

  it("recusa código com a conta ou o prazo trocados", () => {
    const [, assinatura] = criarCodigo("wa:5511999990000", AGORA)!.split(".");
    const outraConta = Buffer.from(JSON.stringify({ u: "wa:5511888880000", e: AGORA + 30 * MINUTO })).toString("base64url");
    const prazoMaior = Buffer.from(JSON.stringify({ u: "wa:5511999990000", e: AGORA + 9999 * MINUTO })).toString("base64url");
    expect(lerCodigo(`${outraConta}.${assinatura}`, AGORA)).toBeNull();
    expect(lerCodigo(`${prazoMaior}.${assinatura}`, AGORA)).toBeNull();
  });

  it("recusa código assinado com outro segredo", () => {
    const codigo = criarCodigo("wa:5511999990000", AGORA)!;
    process.env.PAINEL_LINK_SECRET = "outro-segredo";
    expect(lerCodigo(codigo, AGORA)).toBeNull();
  });

  it("recusa o que não é um código", () => {
    for (const ruim of [null, 12, "", "abc", "a.b.c", "x".repeat(700), ".", "e30."]) {
      expect(lerCodigo(ruim, AGORA)).toBeNull();
    }
  });

  it("usa um segredo que o servidor já tem quando não há um próprio", () => {
    delete process.env.PAINEL_LINK_SECRET;
    expect(criarCodigo("wa:1", AGORA)).toBeNull();
    process.env.TWILIO_AUTH_TOKEN = "token-da-twilio";
    const codigo = criarCodigo("wa:1", AGORA)!;
    expect(lerCodigo(codigo, AGORA)).toBe("wa:1");
    expect(codigo).not.toContain("token-da-twilio");
  });
});

describe("pedidoDePainel", () => {
  it("reconhece o pedido, sem diferenciar maiúscula, acento e pontuação", () => {
    for (const t of ["painel", "Painel", " PAINEL! ", "ver painel", "link", "resumo geral", "gráficos"]) {
      expect(pedidoDePainel(t)).toBe(true);
    }
  });

  it("não confunde com outras mensagens", () => {
    for (const t of ["resumo", "gastei 30 no painel solar", "oi", "quanto gastei?"]) {
      expect(pedidoDePainel(t)).toBe(false);
    }
  });
});

describe("mensagemDoPainel", () => {
  it("monta o link com o código depois do #", () => {
    const texto = mensagemDoPainel("wa:5511999990000", "https://exemplo.test", AGORA);
    const codigo = /https:\/\/exemplo\.test\/p#(\S+)/.exec(texto)?.[1];
    expect(lerCodigo(codigo, AGORA)).toBe("wa:5511999990000");
    expect(texto).toContain("30 minutos");
  });

  it("avisa quando não há como assinar", () => {
    delete process.env.PAINEL_LINK_SECRET;
    expect(mensagemDoPainel("wa:1", "https://exemplo.test", AGORA)).not.toContain("https://");
  });
});

describe("origemDoSite", () => {
  it("em produção na Vercel usa o domínio do projeto", () => {
    process.env.VERCEL_ENV = "production";
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "luana.exemplo.test";
    expect(origemDoSite(new Headers({ host: "outro.test" }))).toBe("https://luana.exemplo.test");
  });

  it("fora dela usa o host da chamada", () => {
    expect(origemDoSite(new Headers({ host: "localhost:3100" }))).toBe("http://localhost:3100");
    expect(origemDoSite(new Headers({ "x-forwarded-host": "previa.test", "x-forwarded-proto": "https" }))).toBe("https://previa.test");
  });
});
