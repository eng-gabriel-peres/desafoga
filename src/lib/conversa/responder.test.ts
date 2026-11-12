import { describe, expect, it } from "vitest";
import { responder } from "./responder";
import { BOAS_VINDAS } from "./textos";

describe("responder", () => {
  it("dá as boas-vindas quando não há persona", () => {
    expect(responder("bom dia", null)).toEqual({ mensagens: [BOAS_VINDAS], persona: null });
  });

  it("mostra o raio-x ao escolher uma persona, com acento ou maiúscula", () => {
    const r = responder("Quero ver a ANA", null);
    expect(r.persona).toBe("ana");
    // cartão: 234.076 x 13,8% = 32.302; cheque: 60.000 x 8% = 4.800
    expect(r.mensagens[0]).toContain("R$ 371,02 de juros por mês");
    expect(r.mensagens[0]).toContain("R$ 196,56 foram só encargos");
  });

  it("monta o plano com o valor informado", () => {
    const r = responder("consigo pagar R$ 900", "ana");
    expect(r.persona).toBe("ana");
    expect(r.mensagens[0]).toMatch(/quita tudo em \*\d+ meses\*/);
    expect(r.mensagens[0]).toContain("1. Cartão Banco Exemplo (rotativo)");
  });

  it("soma aos mínimos quando a pessoa diz 'a mais'", () => {
    // mínimos da Ana: 351,11 + 60,00 = 411,11
    const r = responder("e se eu pagar 200 a mais?", "ana");
    expect(r.mensagens[0]).toContain("R$ 611,11 por mês");
  });

  it("avisa quando o valor não cobre os mínimos", () => {
    expect(responder("100", "ana").mensagens[0]).toContain("não dá para cobrir");
  });

  it("volta ao início com 'trocar'", () => {
    expect(responder("trocar", "ana").persona).toBeNull();
  });
});
