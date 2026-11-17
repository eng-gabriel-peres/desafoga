/**
 * Acesso à Pluggy (Open Finance). Só roda no servidor: usa o Client ID e o
 * Client Secret. O resto do app conversa com a interface `ClientePluggy`,
 * para os testes trocarem a Pluggy de verdade pelas respostas do sandbox.
 */
import { PluggyClient, type Account, type CreditCardBills, type Investment, type Item, type Loan, type Transaction } from "pluggy-sdk";

export type PluggyItem = Item;
export type PluggyConta = Account;
export type PluggyTransacao = Transaction;
export type PluggyEmprestimo = Loan;
export type PluggyFatura = CreditCardBills;
export type PluggyInvestimento = Investment;

export interface ClientePluggy {
  item(itemId: string): Promise<PluggyItem>;
  contas(itemId: string): Promise<PluggyConta[]>;
  /** Todas as transações da conta (percorre o cursor do /v2/transactions). */
  transacoes(contaId: string, desde?: { criadasDesde?: string }): Promise<PluggyTransacao[]>;
  emprestimos(itemId: string): Promise<PluggyEmprestimo[]>;
  faturas(contaId: string): Promise<PluggyFatura[]>;
  identidade(itemId: string): Promise<{ cpf: string | null; nome: string | null }>;
  investimentos(itemId: string): Promise<PluggyInvestimento[]>;
  /** Pede ao banco dados novos (PATCH /items/{id}); a Pluggy limita a 1 por hora. */
  pedirAtualizacao(itemId: string): Promise<void>;
  apagarItem(itemId: string): Promise<void>;
  tokenDeConexao(o: { itemId?: string; clientUserId: string; webhookUrl?: string }): Promise<string>;
}

export function pluggyConfigurado(): boolean {
  return Boolean(process.env.PLUGGY_CLIENT_ID && process.env.PLUGGY_CLIENT_SECRET);
}

let unico: ClientePluggy | null = null;

export function clientePluggy(): ClientePluggy {
  if (unico) return unico;
  if (!pluggyConfigurado()) throw new Error("Pluggy não configurada (PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET).");
  const api = new PluggyClient({ clientId: process.env.PLUGGY_CLIENT_ID!, clientSecret: process.env.PLUGGY_CLIENT_SECRET! });
  unico = {
    item: (id) => api.fetchItem(id),
    contas: async (id) => (await api.fetchAccounts(id)).results,
    transacoes: (conta, desde) => api.fetchAllTransactions(conta, desde?.criadasDesde ? { createdAtFrom: desde.criadasDesde } : {}),
    emprestimos: async (id) => (await api.fetchLoans(id, { pageSize: 100 })).results,
    faturas: async (conta) => (await api.fetchCreditCardBills(conta, { pageSize: 100 })).results,
    identidade: async (id) => {
      try {
        const i = await api.fetchIdentityByItemId(id);
        return { cpf: i.document ? i.document.replace(/\D/g, "") || null : null, nome: i.fullName ?? null };
      } catch {
        // Nem todo banco entrega identidade; sem ela, só não reconhecemos transferência pelo CPF.
        return { cpf: null, nome: null };
      }
    },
    investimentos: async (id) => (await api.fetchInvestments(id)).results,
    pedirAtualizacao: async (id) => {
      await api.updateItem(id);
    },
    apagarItem: (id) => api.deleteItem(id),
    tokenDeConexao: async ({ itemId, clientUserId, webhookUrl }) =>
      (await api.createConnectToken(itemId, { clientUserId, webhookUrl, avoidDuplicates: true })).accessToken,
  };
  return unico;
}
