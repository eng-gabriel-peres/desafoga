import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { partir } from "./enviar";
import { assinaturaValida, extrairMensagem, lerFormulario } from "./webhook";

const TOKEN = "token-de-teste";
const URL_DO_WEBHOOK = "https://exemplo.test/api/twilio/webhook";

/** Assinatura calculada à parte, do jeito que a documentação da Twilio descreve. */
function assinar(url: string, parametros: Record<string, string>, token = TOKEN): string {
  let dados = url;
  for (const nome of Object.keys(parametros).sort()) dados += nome + parametros[nome];
  return createHmac("sha1", token).update(dados).digest("base64");
}

describe("assinaturaValida", () => {
  const parametros = { To: "whatsapp:+14155238886", From: "whatsapp:+5511999990000", Body: "almoço 35", MessageSid: "SM1" };

  it("aceita a chamada assinada com o token certo, com acento no corpo", () => {
    expect(assinaturaValida(URL_DO_WEBHOOK, parametros, assinar(URL_DO_WEBHOOK, parametros), TOKEN)).toBe(true);
  });

  it("recusa corpo alterado, endereço diferente, token errado e cabeçalho ausente", () => {
    const assinatura = assinar(URL_DO_WEBHOOK, parametros);
    expect(assinaturaValida(URL_DO_WEBHOOK, { ...parametros, Body: "almoço 3500" }, assinatura, TOKEN)).toBe(false);
    expect(assinaturaValida(`${URL_DO_WEBHOOK}?x=1`, parametros, assinatura, TOKEN)).toBe(false);
    expect(assinaturaValida(URL_DO_WEBHOOK, parametros, assinatura, "outro-token")).toBe(false);
    expect(assinaturaValida(URL_DO_WEBHOOK, parametros, null, TOKEN)).toBe(false);
    expect(assinaturaValida(URL_DO_WEBHOOK, parametros, "curta", TOKEN)).toBe(false);
  });
});

describe("extrairMensagem", () => {
  it("lê texto do formulário e deixa o telefone só com dígitos", () => {
    const p = lerFormulario("MessageSid=SM1&From=whatsapp%3A%2B5511999990000&Body=almo%C3%A7o+35&NumMedia=0");
    expect(extrairMensagem(p)).toEqual({ id: "SM1", de: "5511999990000", tipo: "text", texto: "almoço 35" });
  });

  it("classifica áudio, foto e PDF pelo tipo do arquivo", () => {
    const base = { MessageSid: "MM1", From: "whatsapp:+5511999990000", NumMedia: "1", MediaUrl0: "https://api.twilio.com/m/1" };
    expect(extrairMensagem({ ...base, MediaContentType0: "audio/ogg; codecs=opus" })).toMatchObject({ tipo: "audio", midiaMime: "audio/ogg" });
    expect(extrairMensagem({ ...base, MediaContentType0: "image/jpeg" })?.tipo).toBe("image");
    expect(extrairMensagem({ ...base, MediaContentType0: "application/pdf" })?.tipo).toBe("document");
    expect(extrairMensagem({ ...base, MediaContentType0: "video/mp4" })?.tipo).toBe("outro");
  });

  it("ignora o que não é mensagem de WhatsApp", () => {
    expect(extrairMensagem({ MessageSid: "SM1", From: "+5511999990000", Body: "oi" })).toBeNull();
    expect(extrairMensagem({ From: "whatsapp:+5511999990000", Body: "oi" })).toBeNull();
    expect(extrairMensagem({ MessageSid: "SM1", From: "whatsapp:+5511999990000", Body: "  " })?.tipo).toBe("outro");
  });
});

describe("partir", () => {
  it("deixa a mensagem curta inteira", () => {
    expect(partir("oi")).toEqual(["oi"]);
  });

  it("quebra entre parágrafos sem perder texto nem passar do limite", () => {
    const paragrafos = Array.from({ length: 12 }, (_, i) => `Parágrafo ${i} ${"x".repeat(40)}`);
    const pedacos = partir(paragrafos.join("\n\n"), 200);
    expect(pedacos.length).toBeGreaterThan(1);
    for (const p of pedacos) expect(p.length).toBeLessThanOrEqual(200);
    expect(pedacos.join("\n\n")).toBe(paragrafos.join("\n\n"));
  });

  it("corta no limite quando não há onde quebrar", () => {
    const pedacos = partir("a".repeat(450), 200);
    expect(pedacos.map((p) => p.length)).toEqual([200, 200, 50]);
  });
});
