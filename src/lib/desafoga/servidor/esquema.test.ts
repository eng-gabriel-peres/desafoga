import { describe, expect, it } from "vitest";
import { comEsquema, ESQUEMA } from "./esquema";

describe("comEsquema", () => {
  it("põe o esquema do Desafoga na URL", () => {
    const url = new URL(comEsquema("postgresql://u:s@servidor:5432/banco"));
    expect(url.searchParams.get("schema")).toBe(ESQUEMA);
    expect(url.pathname).toBe("/banco");
  });

  it("mantém o que já estava na URL, como o sslmode da Neon", () => {
    const url = new URL(comEsquema("postgresql://u:s@neon.tech/banco?sslmode=require&channel_binding=require"));
    expect(url.searchParams.get("sslmode")).toBe("require");
    expect(url.searchParams.get("channel_binding")).toBe("require");
    expect(url.searchParams.get("schema")).toBe(ESQUEMA);
  });

  it("troca um esquema já escrito, em vez de somar outro", () => {
    const url = new URL(comEsquema("postgresql://u:s@servidor/banco?schema=public"));
    expect(url.searchParams.getAll("schema")).toEqual([ESQUEMA]);
  });

  it("devolve vazio quando não há URL, para o erro do Prisma continuar o mesmo", () => {
    expect(comEsquema("")).toBe("");
  });

  it("não quebra com uma URL que o parser não entende", () => {
    expect(comEsquema("isto não é uma url")).toBe("isto não é uma url");
  });
});
