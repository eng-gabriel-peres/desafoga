import { afterEach, describe, expect, it, vi } from "vitest";
import { comNonoDigito, enviarTexto } from "./enviar";

describe("comNonoDigito", () => {
  it("acrescenta o 9 a celular brasileiro de 8 dígitos", () => {
    expect(comNonoDigito("554899990000")).toBe("5548999990000");
  });

  it("não mexe em número que já tem 9 dígitos nem em número de outro país", () => {
    expect(comNonoDigito("5548999990000")).toBeNull();
    expect(comNonoDigito("15551524686")).toBeNull();
  });
});

describe("enviarTexto", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  function prepararChamadas(respostas: Response[]) {
    vi.stubEnv("WHATSAPP_TOKEN", "token-de-teste");
    vi.stubEnv("WHATSAPP_PHONE_NUMBER_ID", "123");
    const chamada = vi.fn<(url: string, init: RequestInit) => Promise<Response>>();
    for (const r of respostas) chamada.mockResolvedValueOnce(r);
    vi.stubGlobal("fetch", chamada);
    return () => chamada.mock.calls.map(([, init]) => JSON.parse(String(init.body)).to as string);
  }

  it("tenta de novo com o nono dígito quando a Meta recusa o destinatário", async () => {
    const destinos = prepararChamadas([
      new Response('{"error":{"code":131030}}', { status: 400 }),
      new Response("{}", { status: 200 }),
    ]);
    await enviarTexto("554899990000", "oi");
    expect(destinos()).toEqual(["554899990000", "5548999990000"]);
  });

  it("não repete quando o erro é outro", async () => {
    const destinos = prepararChamadas([new Response('{"error":{"code":190}}', { status: 401 })]);
    await expect(enviarTexto("554899990000", "oi")).rejects.toThrow("401");
    expect(destinos()).toEqual(["554899990000"]);
  });
});
