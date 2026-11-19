import { describe, expect, it } from "vitest";
import { desligadosDe, RECURSOS_DESLIGADOS_PADRAO } from "./recursos";

describe("recursos ligados e desligados", () => {
  it("sem a variável, valem os desligados da apresentação", () => {
    expect(desligadosDe(undefined)).toEqual(new Set(RECURSOS_DESLIGADOS_PADRAO));
    expect(RECURSOS_DESLIGADOS_PADRAO).toEqual(["conteudos", "eventos", "conquistas"]);
  });

  it("vazia liga tudo; com nomes, desliga só esses (ignora espaços e nomes desconhecidos)", () => {
    expect(desligadosDe("")).toEqual(new Set());
    expect(desligadosDe(" eventos , xyz")).toEqual(new Set(["eventos"]));
  });
});
