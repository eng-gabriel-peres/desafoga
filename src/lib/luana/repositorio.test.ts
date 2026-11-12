import { afterAll, describe, expect, it } from "vitest";
import { type Repositorio, repositorioEmArquivo, repositorioPostgres } from "./repositorio";
import type { Conta } from "./resumo";

const conta: Conta = {
  lancamentos: [
    {
      data: "2026-11-10",
      descricao: "Mercado Bom Preço",
      valor: 12345,
      categoria: "mercado",
      natureza: "compra",
      parcela: null,
    },
  ],
  rendaMensal: 400000,
  saldoEmConta: null,
  fatura: null,
} as Conta;

function contrato(nome: string, criar: () => Repositorio) {
  describe(nome, () => {
    const usuario = `teste:${crypto.randomUUID()}`;

    it("devolve conta vazia para quem nunca falou", async () => {
      const repo = criar();
      expect(await repo.buscar(usuario)).toEqual({
        lancamentos: [],
        rendaMensal: null,
        saldoEmConta: null,
        fatura: null,
      });
    });

    it("guarda, atualiza e apaga a conta de uma pessoa", async () => {
      const repo = criar();
      await repo.salvar(usuario, conta);
      expect(await repo.buscar(usuario)).toEqual(conta);

      await repo.salvar(usuario, { ...conta, saldoEmConta: 5000 });
      expect((await repo.buscar(usuario)).saldoEmConta).toBe(5000);

      expect((await repo.buscar(`${usuario}-outra`)).lancamentos).toEqual([]);

      await repo.apagar(usuario);
      expect((await repo.buscar(usuario)).lancamentos).toEqual([]);
    });
  });
}

contrato("repositório em memória", () => repositorioEmArquivo(null));

// Roda só quando há um Postgres de teste: TEST_DATABASE_URL=postgres://...
const url = process.env.TEST_DATABASE_URL;
if (url) {
  const repo = repositorioPostgres(url);
  afterAll(() => repo.fechar());
  contrato("repositório Postgres", () => repo);
} else {
  describe.skip("repositório Postgres (defina TEST_DATABASE_URL)", () => {
    it("pulado", () => {});
  });
}
