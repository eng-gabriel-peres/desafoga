import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { assinaturaValida, extrairMensagens } from "./webhook";

const corpo = {
  object: "whatsapp_business_account",
  entry: [
    {
      changes: [
        {
          field: "messages",
          value: {
            messages: [
              { id: "wamid.1", from: "5500000000000", type: "text", text: { body: "oi" } },
              { id: "wamid.2", from: "5500000000000", type: "image", image: { id: "x" } },
            ],
          },
        },
        { field: "messages", value: { statuses: [{ id: "wamid.0", status: "delivered" }] } },
      ],
    },
  ],
};

describe("extrairMensagens", () => {
  it("lê texto e outros tipos, ignorando status", () => {
    expect(extrairMensagens(corpo)).toEqual([
      { id: "wamid.1", de: "5500000000000", tipo: "text", texto: "oi" },
      { id: "wamid.2", de: "5500000000000", tipo: "image", texto: undefined },
    ]);
  });

  it("não quebra com corpo inesperado", () => {
    expect(extrairMensagens(null)).toEqual([]);
    expect(extrairMensagens({ entry: "x" })).toEqual([]);
  });
});

describe("assinaturaValida", () => {
  const bruto = JSON.stringify(corpo);
  const assinatura = "sha256=" + createHmac("sha256", "segredo-de-teste").update(bruto).digest("hex");

  it("aceita a assinatura correta", () => {
    expect(assinaturaValida(bruto, assinatura, "segredo-de-teste")).toBe(true);
  });

  it("recusa corpo alterado, segredo errado ou cabeçalho ausente", () => {
    expect(assinaturaValida(bruto + " ", assinatura, "segredo-de-teste")).toBe(false);
    expect(assinaturaValida(bruto, assinatura, "outro")).toBe(false);
    expect(assinaturaValida(bruto, null, "segredo-de-teste")).toBe(false);
    expect(assinaturaValida(bruto, "sha256=zz", "segredo-de-teste")).toBe(false);
  });
});
