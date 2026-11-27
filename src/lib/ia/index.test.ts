import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const chamado: string[] = [];
vi.mock("./gemini", () => ({
  geminiConfigurado: () => Boolean(process.env.GEMINI_API_KEY),
  gerarComGemini: async () => (chamado.push("gemini"), '{"ok":true}'),
}));
vi.mock("./claude-local", async (original) => ({
  ...(await original<typeof import("./claude-local")>()),
  gerarComClaudeLocal: async () => (chamado.push("claude"), '{"ok":true}'),
}));

const ia = await import("./index");
const Ok = z.object({ ok: z.boolean() });
const audio = ia.parteDeArquivo(new Uint8Array(), "audio/ogg");
const pdf = ia.parteDeArquivo(new Uint8Array(), "application/pdf");

beforeEach(() => {
  chamado.length = 0;
  vi.stubEnv("IA_PROVEDOR", "");
  vi.stubEnv("GEMINI_API_KEY", "");
  vi.stubEnv("VERCEL", "");
});
afterEach(() => vi.unstubAllEnvs());

describe("escolha da IA", () => {
  it("sem nada configurado, não há IA", async () => {
    expect(ia.iaConfigurada()).toBe(false);
    await expect(ia.gerarTexto("s", "oi")).rejects.toBeInstanceOf(ia.IaIndisponivel);
  });

  it("por padrão usa o Gemini quando há chave", async () => {
    vi.stubEnv("GEMINI_API_KEY", "k");
    expect(ia.iaConfigurada()).toBe(true);
    expect(await ia.gerarJson(Ok, "s", [pdf])).toEqual({ ok: true });
    expect(chamado).toEqual(["gemini"]);
  });

  it("claude-local atende texto, PDF e imagem mesmo sem chave do Gemini", async () => {
    vi.stubEnv("IA_PROVEDOR", "claude-local");
    expect(ia.iaConfigurada()).toBe(true);
    await ia.gerarTexto("s", "oi");
    await ia.gerarJson(Ok, "s", [pdf, ia.parteDeArquivo(new Uint8Array(), "image/jpeg")]);
    expect(chamado).toEqual(["claude", "claude"]);
  });

  it("no claude-local, o áudio vai para o Gemini; sem chave, não há quem ouça", async () => {
    vi.stubEnv("IA_PROVEDOR", "claude-local");
    expect(ia.iaOuve("audio/ogg")).toBe(false);
    await expect(ia.gerarJson(Ok, "s", [audio])).rejects.toBeInstanceOf(ia.IaIndisponivel);

    vi.stubEnv("GEMINI_API_KEY", "k");
    expect(ia.iaOuve("audio/ogg")).toBe(true);
    await ia.gerarJson(Ok, "s", [audio]);
    expect(chamado).toEqual(["gemini"]);
  });

  it("na Vercel, claude-local fica desligado (não cai no Gemini por engano)", () => {
    vi.stubEnv("IA_PROVEDOR", "claude-local");
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("GEMINI_API_KEY", "k");
    expect(ia.iaConfigurada()).toBe(false);
  });
});
