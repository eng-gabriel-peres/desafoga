import { describe, expect, it } from "vitest";
import { minutosDeLeitura, paragrafos, resultadoDaEnquete } from "./conteudos";

describe("conteúdos", () => {
  it("parágrafos separados por linha em branco", () => {
    expect(paragrafos("Um.\nainda um.\n\n  Dois. \n\n\nTrês.")).toEqual(["Um.\nainda um.", "Dois.", "Três."]);
  });

  it("minutos de leitura: 200 palavras por minuto, pelo menos 1", () => {
    expect(minutosDeLeitura(["palavra ".repeat(450)])).toBe(2);
    expect(minutosDeLeitura(["curto"])).toBe(1);
  });

  it("enquete: soma os votos iniciais e os de verdade; o meu voto aparece", () => {
    const r = resultadoDaEnquete(["Manhã", "Noite"], [1, 2], [{ quem: "a", opcao: 1 }, { quem: "b", opcao: 0 }], "a");
    expect(r).toEqual({ total: 5, meu: 1, opcoes: [{ texto: "Manhã", votos: 2, porcento: 40 }, { texto: "Noite", votos: 3, porcento: 60 }] });
    expect(resultadoDaEnquete(["A", "B"], [], [], null)).toMatchObject({ total: 0, meu: null, opcoes: [{ porcento: 0 }, { porcento: 0 }] });
  });
});
