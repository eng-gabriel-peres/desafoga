/**
 * Pluggy de mentira para testes: responde com o que o banco de teste da
 * Pluggy ("Pluggy Bank", login user-ok) devolveu em 17/11/2026.
 */
import accounts from "./fixtures/sandbox/accounts.json";
import bills from "./fixtures/sandbox/bills.json";
import identity from "./fixtures/sandbox/identity.json";
import investments from "./fixtures/sandbox/investments.json";
import item from "./fixtures/sandbox/item.json";
import loans from "./fixtures/sandbox/loans.json";
import transacoesCartao from "./fixtures/sandbox/transacoes-cartao.json";
import transacoesConta from "./fixtures/sandbox/transacoes-conta.json";
import type { ClientePluggy, PluggyConta, PluggyEmprestimo, PluggyFatura, PluggyInvestimento, PluggyItem, PluggyTransacao } from "./pluggy";

export interface DadosFalsos {
  item: PluggyItem;
  contas: PluggyConta[];
  /** Transações por id de conta. */
  transacoes: Record<string, PluggyTransacao[]>;
  emprestimos: PluggyEmprestimo[];
  /** Faturas por id de conta (cartão). */
  faturas: Record<string, PluggyFatura[]>;
  identidade: { cpf: string | null; nome: string | null };
  investimentos: PluggyInvestimento[];
}

const copia = <T>(x: unknown): T => structuredClone(x) as T;

export function dadosDoSandbox(): DadosFalsos {
  const contas = copia<PluggyConta[]>(accounts);
  const cartao = contas.find((c) => c.type === "CREDIT")!;
  const conta = contas.find((c) => c.type === "BANK")!;
  return {
    item: copia<PluggyItem>(item),
    contas,
    transacoes: { [conta.id]: copia(transacoesConta), [cartao.id]: copia(transacoesCartao) },
    emprestimos: copia(loans),
    faturas: { [cartao.id]: copia(bills) },
    identidade: { cpf: (identity as { document: string }).document.replace(/\D/g, ""), nome: (identity as { fullName: string }).fullName },
    investimentos: copia(investments),
  };
}

export function clienteFalso(sobrescrever: Partial<DadosFalsos> & { falhar?: boolean } = {}): ClientePluggy & { chamadas: string[]; dados: DadosFalsos } {
  const { falhar, ...resto } = sobrescrever;
  const dados: DadosFalsos = { ...dadosDoSandbox(), ...resto };
  const chamadas: string[] = [];
  const responder = async <T>(nome: string, valor: () => T): Promise<T> => {
    chamadas.push(nome);
    if (falhar) throw new Error("Pluggy indisponível (teste)");
    return valor();
  };
  return {
    chamadas,
    dados,
    item: (id) => responder(`item:${id}`, () => dados.item),
    contas: (id) => responder(`contas:${id}`, () => dados.contas),
    transacoes: (conta, desde) =>
      responder(`transacoes:${conta}`, () =>
        (dados.transacoes[conta] ?? []).filter((t) => !desde?.criadasDesde || new Date(t.createdAt) >= new Date(desde.criadasDesde)),
      ),
    emprestimos: (id) => responder(`emprestimos:${id}`, () => dados.emprestimos),
    faturas: (conta) => responder(`faturas:${conta}`, () => dados.faturas[conta] ?? []),
    identidade: (id) => responder(`identidade:${id}`, () => dados.identidade),
    investimentos: (id) => responder(`investimentos:${id}`, () => dados.investimentos),
    pedirAtualizacao: (id) => responder(`pedirAtualizacao:${id}`, () => undefined),
    apagarItem: (id) => responder(`apagarItem:${id}`, () => undefined),
    tokenDeConexao: (o) => responder(`tokenDeConexao:${o.itemId ?? ""}`, () => "token-de-teste"),
  };
}
