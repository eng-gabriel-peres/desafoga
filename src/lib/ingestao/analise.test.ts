import { describe, expect, it } from "vitest";
import { contextoDoCliente, contextoParaCliente } from "@/lib/conversa/contexto";
import { lerPercentual, montarAnalise } from "./analise";
import type { FaturaExtraida } from "./extrair";

const fatura: FaturaExtraida = {
  legivel: true,
  tipo: "fatura_cartao",
  emissor: "Banco Exemplo",
  vencimento: "2026-11-10",
  total: "2.340,76",
  pagamentoMinimo: "351,11",
  taxaRotativoMensal: "13,80",
  encargos: [
    { descricao: "ENCARGOS ROTATIVO", valor: "187,44" },
    { descricao: "IOF", valor: "9,12" },
  ],
  lancamentos: [{ data: "2026-10-03", descricao: "MERCADO BOM PRECO", valor: "412,30" }],
};

describe("montarAnalise", () => {
  it("converte a transcrição em centavos e frações", () => {
    const r = montarAnalise(fatura);
    if (!r.ok) throw new Error(r.motivo);
    expect(r.analise.encargosDaFatura).toBe(19656);
    expect(r.analise.dividas).toEqual([
      {
        id: "cartao",
        nome: "Fatura Banco Exemplo",
        tipo: "cartao_rotativo",
        saldo: 234076,
        taxaMensal: 0.138,
        pagamentoMinimo: 35111,
      },
    ]);
    expect(r.avisos).toEqual([]);
  });

  it("não inventa taxa: sem ela, não cria dívida e avisa", () => {
    const r = montarAnalise({ ...fatura, taxaRotativoMensal: null });
    if (!r.ok) throw new Error(r.motivo);
    expect(r.analise.dividas).toEqual([]);
    expect(r.avisos[0]).toContain("taxa de juros");
  });

  it("usa 15% do total quando não há pagamento mínimo, e avisa", () => {
    const r = montarAnalise({ ...fatura, pagamentoMinimo: null });
    if (!r.ok) throw new Error(r.motivo);
    expect(r.analise.dividas[0].pagamentoMinimo).toBe(35111);
    expect(r.avisos[0]).toContain("15%");
  });

  it("recusa arquivo ilegível ou que não é fatura", () => {
    expect(montarAnalise({ ...fatura, legivel: false }).ok).toBe(false);
    expect(montarAnalise({ ...fatura, tipo: "outro" }).ok).toBe(false);
  });
});

describe("lerPercentual", () => {
  it("lê percentuais com vírgula, ponto e símbolo", () => {
    expect(lerPercentual("13,80")).toBeCloseTo(0.138);
    expect(lerPercentual("8.5%")).toBeCloseTo(0.085);
    expect(lerPercentual("sem taxa")).toBeNull();
    expect(lerPercentual("450")).toBeNull();
  });
});

describe("contexto do chat web", () => {
  it("vai e volta com a análise de fatura", () => {
    const r = montarAnalise(fatura);
    if (!r.ok) throw new Error(r.motivo);
    const enviado = contextoParaCliente(r.analise);
    expect(enviado.persona).toBeNull();
    expect(contextoDoCliente(enviado.persona, enviado.analise)).toEqual(r.analise);
  });

  it("recusa análise adulterada e cai na persona, se houver", () => {
    const adulterada = { id: "fatura", nome: "x", perfil: "y", encargosDaFatura: -1, dividas: [] };
    expect(contextoDoCliente(null, adulterada)).toBeNull();
    expect(contextoDoCliente("ana", adulterada)?.id).toBe("ana");
  });
});
