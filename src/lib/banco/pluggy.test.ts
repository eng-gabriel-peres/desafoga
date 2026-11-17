import { afterEach, describe, expect, it, vi } from "vitest";
import { clienteFalso } from "./cliente-falso";
import { pluggyConfigurado } from "./pluggy";

const CONTA = "891f0e61-463b-44b1-a914-908e579ac8df";
const CARTAO = "d2cbd67e-2de7-45b3-bdae-63ab6541349f";

describe("cliente Pluggy falso (respostas do sandbox)", () => {
  it("devolve as transações de cada conta", async () => {
    const c = clienteFalso();
    expect(await c.transacoes(CARTAO)).toHaveLength(18);
    expect(await c.transacoes(CONTA)).toHaveLength(32);
  });

  it("devolve o empréstimo consignado do banco de teste", async () => {
    const emprestimos = await clienteFalso().emprestimos("qualquer");
    expect(emprestimos).toHaveLength(1);
    expect(emprestimos[0].productName).toBe("Crédito Pessoal Consignado");
  });

  it("aceita sobrescrever listas e simular falha", async () => {
    const c = clienteFalso({ emprestimos: [] });
    expect(await c.emprestimos("x")).toEqual([]);
    await expect(clienteFalso({ falhar: true }).contas("x")).rejects.toThrow();
  });

  it("registra as chamadas feitas", async () => {
    const c = clienteFalso();
    await c.pedirAtualizacao("item-1");
    expect(c.chamadas).toContain("pedirAtualizacao:item-1");
  });
});

describe("pluggyConfigurado", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("é falso sem as duas variáveis e verdadeiro com elas", () => {
    vi.stubEnv("PLUGGY_CLIENT_ID", "");
    vi.stubEnv("PLUGGY_CLIENT_SECRET", "");
    expect(pluggyConfigurado()).toBe(false);
    vi.stubEnv("PLUGGY_CLIENT_ID", "id");
    expect(pluggyConfigurado()).toBe(false);
    vi.stubEnv("PLUGGY_CLIENT_SECRET", "segredo");
    expect(pluggyConfigurado()).toBe(true);
  });
});
