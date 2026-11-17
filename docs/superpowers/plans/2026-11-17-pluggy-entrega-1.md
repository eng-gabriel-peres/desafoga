# Bancos conectados — Entrega 1 · Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Conectar bancos pela Pluggy e usar os dados para:
- compras para revisar, com registro pré-preenchido;
- compras parceladas;
- transferências próprias;
- dívidas do banco;
- a visão "Próximos meses";
- uma demonstração que funciona sem banco.

**Architecture:**
- **Regras puras** em `src/lib/banco/*`:
  - normalizar a transação da Pluggy;
  - classificar;
  - relacionar (transferências, parcelas, compras manuais);
  - empréstimo → dívida.
- **Sincronização idempotente** em `src/lib/banco/sincronizar.ts`. Recebe um `ClientePluggy` injetado (real ou falso, com as respostas do sandbox) e grava pelo `repositorio`.
- **Ações** `banco.*` na API existente (`rotas.ts`), `BancoService` nos serviços, e telas em `src/components/desafoga/banco/*`.

**Tech Stack:**
- Next.js 16.4.6 (App Router), React 19, Prisma 7 + Postgres, zod 4, Vitest
- `pluggy-sdk@0.94.3` (servidor)
- `react-pluggy-connect@2.12.0` (janela)

**Spec:** `docs/superpowers/specs/2026-11-17-pluggy-open-finance-design.md`. Leia as seções 3, 5 e 6 antes de qualquer tarefa.

## Global Constraints

- **Formato dos dados:**
  - valores em **centavos** (Int, sempre positivos, com a direção num campo à parte);
  - datas de dia como `YYYY-MM-DD` no fuso de Brasília (`hojeEmBrasilia()` / `chaveDoDia` de `@/lib/finance`);
  - taxas como fração ao mês.
- **Código:** nomes de código e textos em **português**, no estilo do projeto (`conexao`, `movimento`, `sincronizar`).
- **Next 16:** antes de usar `after()` ou criar route handler, ler `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/after.md` e o guia de route handlers.
- **Migrações só aditivas:** `pnpm exec prisma migrate dev --create-only --name <nome>`, conferir o SQL e depois `pnpm exec prisma migrate dev`.
- **Transações da Pluggy:** só **`GET /v2/transactions`** (no SDK: `fetchTransactionsCursor` / `fetchAllTransactions`). Nunca `fetchTransactions`.
- **Sinais da Pluggy:**
  - não decidir a direção pelo sinal do `amount`;
  - valor = `Math.round(Math.abs(amount) * 100)`.
- **Segredos:**
  - `PLUGGY_CLIENT_ID` e `PLUGGY_CLIENT_SECRET` só no servidor, nunca em `NEXT_PUBLIC_*`;
  - novos: `PLUGGY_WEBHOOK_SEGREDO`, `PLUGGY_WEBHOOK_URL` (opcional, https), `PLUGGY_SANDBOX` (`"1"` mostra os bancos de teste).
- **Janela de avisos:** só movimentos com `data ≥ conectadaEm − 7 dias` podem virar aviso ou compra automática. O resto entra como `historico`.
- **Atualização na Pluggy:** `PATCH /items/{id}` no máximo 1 vez por hora por conexão.
- **Webhook:** responder 2xx em até 10 s e processar depois com `after()`.
- **Acesso:**
  - escrita sempre com `exigirAPropriaPessoa`;
  - a profissional lê com `exigirVer` **e** só se `Rotina.compartilharContas`.
- **Gate de cada commit:**
  - `pnpm test > /tmp/t.log 2>&1; grep -E "Tests .*passed|failed" /tmp/t.log` mostra 0 falhas;
  - `pnpm typecheck` e `pnpm lint` sem erros.

## Review Focus

1. **Sincronizar duas vezes seguidas** (botão + abrir o app, ou webhook repetido) não pode duplicar movimento, aviso, mensagem da Luana, sugestão ou compra automática. O teste fica na Tarefa 9.
2. **Transação que muda de PENDING para POSTED** (mesmo `pluggyId`, valor ou data diferentes) atualiza o movimento sem gerar segundo aviso. A Pluggy também pode apagar a transação (`transactions/deleted`); se ela ainda estava em revisão, o aviso some. O teste fica na Tarefa 9.
3. **Números absurdos do banco de teste** (130.632 parcelas, faturas de 2023, saldo menor que a parcela) não podem aparecer na tela nem entrar nos cálculos sem a marca "confira". O teste fica na Tarefa 5, com a fixture real do sandbox.
4. **Primeira conexão com 12 meses de histórico** gera no máximo os avisos dos últimos 7 dias. Compras parceladas antigas com parcela recente pedem emoção uma vez só. O teste fica na Tarefa 9.
5. **Pluggy fora do ar ou chave errada** durante a sincronização: a conexão fica com `status: "erro"`, a tela mostra "Não consegui atualizar agora" e nada que já existia é apagado. O teste fica na Tarefa 9.

---

### Task 1: Cliente Pluggy e fixtures do sandbox

**Files:**
- Create: `src/lib/banco/pluggy.ts`, `src/lib/banco/cliente-falso.ts`, `src/lib/banco/fixtures/sandbox/{item,accounts,transacoes-conta,transacoes-cartao,loans,bills,identity,investments}.json`
- Modify: `package.json` (deps), `.env.example` (se existir; senão o README, seção de variáveis)
- Test: `src/lib/banco/pluggy.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // pluggy.ts — só servidor
  export interface ClientePluggy {
    item(itemId: string): Promise<PluggyItem>;
    contas(itemId: string): Promise<PluggyConta[]>;
    transacoes(contaId: string, desde?: { criadasDesde?: string }): Promise<PluggyTransacao[]>; // percorre todo o cursor
    emprestimos(itemId: string): Promise<PluggyEmprestimo[]>;
    faturas(contaId: string): Promise<PluggyFatura[]>;
    identidade(itemId: string): Promise<{ cpf: string | null; nome: string | null }>;
    investimentos(itemId: string): Promise<PluggyInvestimento[]>;
    pedirAtualizacao(itemId: string): Promise<void>;          // PATCH /items/{id}
    apagarItem(itemId: string): Promise<void>;
    tokenDeConexao(o: { itemId?: string; clientUserId: string; webhookUrl?: string }): Promise<string>;
  }
  export function pluggyConfigurado(): boolean;
  export function clientePluggy(): ClientePluggy; // singleton com pluggy-sdk
  ```
  - `PluggyItem`, `PluggyConta`, `PluggyTransacao`, `PluggyEmprestimo`, `PluggyFatura` e `PluggyInvestimento` são **reexports** dos tipos do `pluggy-sdk` (Item, Account, Transaction, Loan, CreditCardBills, Investment).
- Produces: `clienteFalso(dados?: Partial<DadosFalsos>): ClientePluggy & { chamadas: string[] }` (em `cliente-falso.ts`):
  - por padrão, lê as fixtures do sandbox;
  - `dados` sobrescreve qualquer lista;
  - `falhar: true` faz todo método rejeitar.

- [ ] **Step 1:** `pnpm add pluggy-sdk@0.94.3 react-pluggy-connect@2.12.0`.
- [ ] **Step 2:** Copiar os JSON de `/private/tmp/claude-501/-Volumes-Volume-1TB-Hackaton-desafoga/d945218e-257e-475c-97f0-3eb82956fef0/scratchpad/pluggy/` para `src/lib/banco/fixtures/sandbox/`, guardando só o array `results` quando houver. Os nomes ficam: `tx-891f…` → `transacoes-conta.json`, `tx-d2cb…` → `transacoes-cartao.json`, `inv.json` → `investments.json`. **Não copiar `key`.** Os dados são fictícios do sandbox.
- [ ] **Step 3: Teste que falha.** Em `pluggy.test.ts`:
  - `clienteFalso().transacoes(<id do cartão>)` devolve 18 itens e `transacoes(<id da conta>)` devolve 32;
  - `emprestimos()` tem 1 item com `productName === "Crédito Pessoal Consignado"`;
  - `pluggyConfigurado()` é `false` sem as variáveis e `true` com ambas (usar `vi.stubEnv`).
- [ ] **Step 4:** Rodar `pnpm vitest run src/lib/banco/pluggy.test.ts` e confirmar que FALHA (módulo não existe).
- [ ] **Step 5:** Implementar `pluggy.ts` sobre `PluggyClient` e `cliente-falso.ts`:
  - `transacoes` usa `fetchAllTransactions(contaId, { createdAtFrom })`;
  - `tokenDeConexao` chama `createConnectToken(itemId, { clientUserId, webhookUrl, avoidDuplicates: true })`.
- [ ] **Step 6:** Rodar de novo e confirmar que PASSA.
- [ ] **Step 7:** Commit `feat(banco): cliente Pluggy e respostas do sandbox para testes`.

### Task 2: Tipos do banco e normalização da transação

**Files:**
- Create: `src/lib/banco/tipos.ts`, `src/lib/banco/normalizar.ts`
- Test: `src/lib/banco/normalizar.test.ts`

**Interfaces:**
- Produces (`tipos.ts`, importável no cliente; sem nada da Pluggy):
  ```ts
  export type ModoCompras = "revisar" | "automatico" | "desligado";
  export type TipoDeContaBancaria = "corrente" | "poupanca" | "cartao";
  export type Natureza = "compra" | "transferencia-propria" | "pagamento-fatura" | "renda" | "tarifa" | "juros" | "iof" | "estorno" | "outra-entrada" | "outra-saida";
  export type SituacaoDoMovimento = "revisar" | "registrada" | "ignorada" | "historico" | "automatica";
  export type StatusDaConexao = "ok" | "atualizando" | "reconectar" | "erro";
  export interface ContaBancaria { id: string; conexaoId: string; pluggyAccountId: string; tipo: TipoDeContaBancaria; nome: string; saldo: number; limite: number | null; limiteDisponivel: number | null; fechamento: string | null; vencimento: string | null; chequeEspecialUsado: number | null; chequeEspecialLimite: number | null }
  export interface ConexaoBancaria { id: string; pluggyItemId: string | null /* null = Banco Demonstração */; banco: string; logo: string | null; status: StatusDaConexao; ultimaSincronizacao: string | null; proximaAtualizacaoPossivel: string | null; consentimentoAte: string | null; conectadaEm: string; contas: ContaBancaria[] }
  export interface MovimentoNovo { pluggyId: string; contaId: string; data: string; descricao: string; descricaoOriginal: string; valor: number; direcao: "saida" | "entrada"; categoriaPluggy: string | null; parcela: number | null; totalParcelas: number | null; valorTotalDaCompra: number | null; compradaEm: string | null; faturaPrevista: string | null; cnpj: string | null; mcc: number | null; documentoContraparte: string | null; jurosBoleto: number | null; pendente: boolean }
  export interface Movimento extends MovimentoNovo { id: string; natureza: Natureza; categoria: Categoria | null; situacao: SituacaoDoMovimento; compraId: string | null; parceladaId: string | null }
  export interface CompraParcelada { id: string; nome: string; lojaOriginal: string; categoria: Categoria; valorTotal: number; valorParcela: number; totalParcelas: number; compradaEm: string; contaId: string; compraId: string | null; parcelas: { numero: number; data: string; faturaPrevista: string | null }[] }
  export type CampoDaDivida = "saldo" | "taxaMensal" | "parcelaMinima" | "parcelasRestantes";
  export interface SugestaoDeDivida { chave: string; pluggyLoanId: string | null; tipo: TipoDivida; nome: string; instituicao: string; detalhe: string; saldo: number; taxaMensal: number | null; parcelaMinima: number; vencimento: number; parcelasRestantes: number | null; cet: number | null; temSeguro: boolean; faltaPagarComJuros: number | null; confira: CampoDaDivida[] }
  ```
- Produces (`normalizar.ts`):
  - `tipoDaConta(a: PluggyConta): TipoDeContaBancaria`
  - `normalizarConta(a: PluggyConta): Omit<ContaBancaria, "id" | "conexaoId">`
  - `normalizarTransacao(t: PluggyTransacao, tipo: TipoDeContaBancaria): MovimentoNovo`

**Regra de direção:**
- **Conta corrente ou poupança:** `DEBIT` → saída, `CREDIT` → entrada.
- **Cartão:** é **entrada** só quando a descrição casa `/PAGAMENTO|PGTO|ESTORNO|REEMBOLSO|CREDITO DE/i`; todo o resto é **saída**, seja qual for o `type` e o sinal.
- `data` = data de Brasília de `t.date`.
- `compradaEm` = `creditCardMetadata.purchaseDate` ou `transactionDateTime`, cortado em dia.
- `documentoContraparte` = só dígitos do documento do recebedor (na saída) ou do pagador (na entrada).
- `jurosBoleto` = `interestAmount + penaltyAmount` em centavos, ou null.

- [ ] **Step 1: Teste que falha**, usando as fixtures:
  - a transação `"NETFLIX.COM"` do cartão normaliza para `{ direcao: "saida", valor: 5590, parcela: 2, totalParcelas: 6, valorTotalDaCompra: 33540, mcc: 5812 }`;
  - `"CONDOMINIO EDIFICIO SOLAR"` da conta → `{ direcao: "saida", valor: 80000, data: "2026-11-05" }`;
  - toda transação `CREDIT` positiva da conta → `direcao: "entrada"`;
  - `"Pagamento de boleto"` → `documentoContraparte` só com dígitos, ou null quando não for número;
  - `normalizarConta(<cartão>)` → `{ tipo: "cartao", limite: 30000000, fechamento: "2026-11-17", vencimento: "2026-11-22" }`.
- [ ] **Step 2:** Rodar e confirmar que FALHA.
- [ ] **Step 3:** Implementar `tipos.ts` e `normalizar.ts`.
- [ ] **Step 4:** Rodar e confirmar que PASSA.
- [ ] **Step 5:** Commit `feat(banco): tipos e normalização das transações`.

### Task 3: Classificação (natureza e categoria)

**Files:**
- Create: `src/lib/banco/classificar.ts`, `src/lib/banco/lojas.ts`
- Test: `src/lib/banco/classificar.test.ts`

**Interfaces:**
- Consumes: `MovimentoNovo`, `Natureza` (Task 2)
- Produces:
  ```ts
  export interface RegraDoBanco { padrao: string; efeito: { categoria: Categoria } | { natureza: "transferencia-propria" } | { ignorar: true } }
  export function chaveDaDescricao(descricao: string): string; // maiúsculas, sem acento, sem números de parcela ("3/10", "PARC 03/10"), sem espaços repetidos
  export function naturezaDe(m: MovimentoNovo, ctx: { cpfDoTitular: string | null; regras: RegraDoBanco[] }): Natureza;
  export function categoriaDe(m: MovimentoNovo, regras: RegraDoBanco[]): Categoria; // só para natureza "compra"
  ```
- Produces (`lojas.ts`):
  - `LOJAS: [RegExp, Categoria][]`, com cerca de 60 marcas brasileiras comuns;
  - `CONTAS_DE_CONSUMO: RegExp` (luz, água, gás, condomínio, internet, telefone, aluguel);
  - `MCC_PARA_CATEGORIA: Record<number, Categoria>`.

**Ordem da natureza** (a primeira que decidir vence):
1. regra da pessoa;
2. transferência própria pelo CPF (`documentoContraparte === cpf` só com dígitos) ou pela descrição `/MESMA TITULARIDADE|ENTRE CONTAS|TRANSF.*PROPRIA/i`;
3. pagamento de fatura (`/PAGAMENTO.*(FATURA|CARTAO)|PGTO.*(FAT|CART)/i`; no cartão, qualquer entrada que não seja estorno);
4. estorno;
5. encargos: `iof` (`/\bIOF\b/`), `juros` (`/JUROS|ENCARGOS|MORA/`), `tarifa` (`/TARIFA|ANUIDADE|PACOTE|CESTA|MULTA/`);
6. renda (entrada com `/SALARIO|PROVENTOS|FOLHA/i` ou com categoria Pluggy de salário);
7. `outra-saida` para contas de consumo;
8. `compra` para as demais saídas;
9. `outra-entrada` para as demais entradas.

**Ordem da categoria:** regra → `LOJAS` → `MCC_PARA_CATEGORIA` → categoria Pluggy mapeada → `"Outro"`.

- [ ] **Step 1: Teste que falha** (tabela de casos com `it.each`):

  | Entrada | Esperado |
  |---|---|
  | `"IFOOD *RESTAURANTE"` | compra, "Comida pronta" |
  | `"DROGASIL 123"` | "Farmácia" |
  | `"CARREFOUR"` / `"ASSAI ATACADISTA"` | "Mercado" |
  | `"RENNER"` | "Roupa" |
  | `"NETFLIX.COM"` / `"SPOTIFY AB"` / `"SMART FIT ACADEMIA"` | "Lazer" |
  | desconhecido com mcc 5912 | "Farmácia" |
  | desconhecido sem mcc | "Outro" |
  | `"ELETROBRAS LIGHT SA"` | outra-saida |
  | `"PGTO FATURA NUBANK"` | pagamento-fatura |
  | `"IOF COMPRA EXTERIOR"` | iof |
  | `"ESTORNO SHOPEE"` no cartão | estorno |
  | `"SALARIO EMPRESA X"` entrada | renda |

  Mais quatro casos:
  - transferência com `documentoContraparte` igual ao CPF → transferencia-propria;
  - regra `{ padrao: chaveDaDescricao("PIX JOAO"), efeito: { natureza: "transferencia-propria" } }` vence;
  - regra de categoria vence `LOJAS`;
  - `chaveDaDescricao("MERCADOLIVRE*CELULAR 03/10")` é igual a `chaveDaDescricao("MERCADOLIVRE*CELULAR 04/10")`.
- [ ] **Step 2:** Rodar e confirmar que FALHA.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Rodar e confirmar que PASSA.
- [ ] **Step 5:** Commit `feat(banco): classificação de natureza e categoria`.

### Task 4: Relacionar movimentos (transferências em par, parcelas, compras manuais)

**Files:**
- Create: `src/lib/banco/relacionar.ts`
- Test: `src/lib/banco/relacionar.test.ts`

**Interfaces:**
- Consumes: `Movimento`, `CompraParcelada` (Task 2); `chaveDaDescricao` (Task 3); `Compra` de `@/lib/finance`
- Produces:
  ```ts
  /** Pares saída/entrada de mesmo valor em contas diferentes da pessoa, até 2 dias de distância, ainda não classificados como transferência. Devolve os pluggyIds a remarcar. */
  export function paresDeTransferencia(movs: Pick<Movimento, "pluggyId" | "contaId" | "data" | "valor" | "direcao" | "natureza">[]): string[];
  /** Chave estável da compra parcelada: contaId + compradaEm + valorTotalDaCompra + totalParcelas + chaveDaDescricao. null se o movimento não tem parcela. */
  export function chaveDaParcelada(m: MovimentoNovo): string | null;
  /** Compra manual (via app/whatsapp, sem movimento ligado) que corresponde ao movimento, ou null. */
  export function compraManualCorrespondente(m: Movimento, compras: Compra[], jaLigadas: Set<string>, tipoDaConta: TipoDeContaBancaria): Compra | null;
  ```

**Regras de correspondência** (spec 6.5):
- valor igual com tolerância de 50 centavos, data a até 1 dia (até 3 no cartão);
- para parcelada: valor da compra manual a ±1% de `valorTotalDaCompra`, ou igual à parcela, a até 3 dias de `compradaEm`.

- [ ] **Step 1: Teste que falha:**
  - Nubank saída R$ 200 em 10/11 e PicPay entrada R$ 200 em 11/11 → os dois ids; com 4 dias de distância → `[]`; mesma conta → `[]`.
  - Parcelas 3/10 e 4/10 do `"MERCADOLIVRE*CELULAR"` com mesmo `compradaEm` e total → mesma `chaveDaParcelada`; outra compra com total diferente → chave diferente; movimento sem parcela → `null`.
  - Compra manual `{ item: "Almoço", valor: 3500, quando: <mesmo dia> }` casa com movimento de 3500 na conta corrente.
  - 3550 casa; 3600 não; dois dias depois, na conta corrente, não casa; no cartão, casa.
  - Compra manual `"iPhone"` de 480000 casa com a parcela 1/10 de 48000 (total 480000).
  - Compra já em `jaLigadas` nunca casa.
- [ ] **Step 2:** Rodar e confirmar que FALHA.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Rodar e confirmar que PASSA.
- [ ] **Step 5:** Commit `feat(banco): transferências em par, parcelas e compras manuais`.

### Task 5: Empréstimo e cheque especial → sugestão de dívida

**Files:**
- Create: `src/lib/banco/emprestimos.ts`
- Test: `src/lib/banco/emprestimos.test.ts`

**Interfaces:**
- Consumes: `PluggyEmprestimo` (Task 1); `SugestaoDeDivida`, `ContaBancaria` (Task 2)
- Produces:
  ```ts
  export function taxaMensalDoEmprestimo(l: PluggyEmprestimo): number | null;
  export function sugestaoDoEmprestimo(l: PluggyEmprestimo, instituicao: string, hoje: string): SugestaoDeDivida | null; // null sem saldo utilizável
  export function sugestaoDoChequeEspecial(c: ContaBancaria, instituicao: string): SugestaoDeDivida | null; // só se chequeEspecialUsado > 0; taxaMensal null (pessoa preenche)
  export const TRAVAS = { taxaMensalMax: 0.3, parcelasMax: 480 } as const;
  ```

**Regras (spec 6.4):**
- `YEARLY` → `(1 + r)^(1/12) − 1`; `MONTHLY` → `r`; sem taxa → derivar de `CET` anual; nada → `null` e `confira: ["taxaMensal"]`.
- `saldo`, nesta ordem:
  1. `contractOutstandingBalance` coerente;
  2. valor presente das parcelas restantes;
  3. `totalRemainingAmount` com `"saldo"` em `confira`.
- `kind`: `FINANCING` → `"parcelamento"`; `UNARRANGED_ACCOUNT_OVERDRAFT` → `"cheque"`; o resto → `"emprestimo"`.
- `chave` = `"emprestimo:" + l.id`.
- `detalhe` = `productName`.

- [ ] **Step 1: Teste que falha**, com o empréstimo do sandbox (`fixtures/sandbox/loans.json`):
  - `taxaMensalDoEmprestimo` ≈ `0.03994` (6 casas);
  - a sugestão tem `parcelaMinima: 100004`, `temSeguro: true`, `cet: 0.29`, `faltaPagarComJuros: 2850004`, `tipo: "emprestimo"`, `detalhe: "Crédito Pessoal Consignado"`;
  - `parcelasRestantes` **não** é 14600 nem 130632 (cai na regra `ceil(saldo/parcela)` ou nos meses até `dueDate`) e é ≤ 480;
  - `contractOutstandingBalance` (1000,04) é incoerente por ser ≤ parcela, então `saldo` vem do valor presente e é > 0 e < 2850004;
  - empréstimo sintético com `preFixedRate: 0.05` mensal → `0.05`;
  - taxa 0.45 mensal → `confira` contém `"taxaMensal"`;
  - empréstimo sem nenhum saldo → `null`;
  - conta com `chequeEspecialUsado: 50000` → sugestão `tipo: "cheque"`, `taxaMensal: null`, `confira: ["taxaMensal"]`; com 0 → `null`.
- [ ] **Step 2:** Rodar e confirmar que FALHA.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Rodar e confirmar que PASSA.
- [ ] **Step 5:** Commit `feat(banco): dívidas sugeridas a partir de empréstimos e cheque especial`.

### Task 6: Compra sem emoção, compra parcelada e gastos do mês

**Files:**
- Modify:
  - `src/lib/finance/tipos.ts` (Compra)
  - `src/lib/finance/orcamento.ts`
  - `src/lib/finance/emocao.ts`, `padroes.ts`, `fatura.ts`
  - todo uso de `.emocao` e `.necessidade` (`grep -rn "\.emocao\b\|\.necessidade\b" src`; são ~12 arquivos)
  - `src/services/tipos.ts` (`NovaCompra`)
- Test: `src/lib/finance/orcamento.test.ts`, `emocao.test.ts`, `padroes` (no teste que já existir)

**Interfaces:**
- Produces:
  ```ts
  // Compra passa a ter:
  emocao: Emocao | null; necessidade: Necessidade | null; via: "app" | "whatsapp" | "fatura" | "banco";
  parcelas: number | null; valorDaParcela: number | null; parceladaId: string | null;
  // orcamento.ts
  export interface GastoAvulso { categoria: Categoria; valor: number; data: string /* YYYY-MM-DD */ }
  export function gastoDoMes(compras: Compra[], categoria: Categoria, agora: Date, avulsos?: GastoAvulso[]): number;
  export function orcamentoDoMes(orcamentos: Orcamento[], compras: Compra[], agora: Date, avulsos?: GastoAvulso[]): SituacaoDoOrcamento[];
  /** Valor da compra que cai no mês: parcelada → valorDaParcela se o mês está entre a compra e a última parcela; senão valor no mês de quando. */
  export function valorNoMes(c: Compra, chaveDoMes: string): number;
  ```
- **Emoção:** `notaMedia`, `notaDoDia`, `resumoDaSemana`, `situacaoDoPaciente`, `padroesDeCompra`, `divisaoPorNecessidade` e `custoEmocional` ignoram compras com `emocao === null` (ou `necessidade === null`, na função que usa necessidade).
- **UI:** onde se desenha a carinha, `null` mostra o selo "sem emoção" (texto `text-muted`) em vez do rosto.

- [ ] **Step 1: Teste que falha:**
  - `notaMedia([c(emocao 2), c(emocao null), c(emocao 4)])` = 3;
  - `valorNoMes` de uma parcelada (480000 em 10x de 48000, comprada em 2026-05-10) dá 48000 em `"2026-07"`, 48000 em `"2027-02"`, 0 em `"2027-03"` e 0 em `"2026-04"`;
  - `gastoDoMes` com essa compra em "Outro", agora = 2026-07-15 → 48000;
  - com `avulsos: [{ categoria: "Mercado", valor: 13200, data: "2026-07-14" }]`, `gastoDoMes(..., "Mercado", ...)` inclui 13200;
  - avulso de outro mês não entra.
- [ ] **Step 2:** Rodar e confirmar que FALHA.
- [ ] **Step 3:** Implementar os tipos e funções e corrigir os usos até `pnpm typecheck` passar.
- [ ] **Step 4:** Rodar `pnpm test` completo: os testes antigos continuam passando.
- [ ] **Step 5:** Commit `feat(finance): compra sem emoção, parcelada e gastos avulsos no orçamento`.

### Task 7: Próximos meses

**Files:**
- Create: `src/lib/finance/proximos-meses.ts` (exportar em `src/lib/finance/index.ts`)
- Test: `src/lib/finance/proximos-meses.test.ts`

**Interfaces:**
- Consumes: `ContaFixa`, `Divida`, `Plano`, `Renda` (tipos atuais); `simularQuitacao` de `dividas.ts`; `CompraParcelada` (Task 2)
- Produces:
  ```ts
  export interface CartaoNoMes { contaId: string; nome: string; vencimento: number; faturaAberta: { mes: string; valor: number } | null }
  export interface ItemDoMes { tipo: "conta" | "fatura" | "divida"; nome: string; valor: number; previsto: boolean; detalhe?: string /* "5 parcelas" */ }
  export interface MesComprometido { mes: string; total: number; renda: number | null; sobra: number | null; itens: ItemDoMes[]; terminam: string[] /* nomes que têm a última parcela neste mês */ }
  export function proximosMeses(e: { contas: ContaFixa[]; dividas: Divida[]; plano: Plano; parceladas: CompraParcelada[]; cartoes: CartaoNoMes[]; renda: Renda | null }, agora: Date, quantos = 12): MesComprometido[];
  ```

**Regras (spec 5.5 e 6.5):**
- Fatura de um cartão num mês:
  - mês da fatura aberta → valor real;
  - meses seguintes → soma das parcelas daquele cartão que caem no mês, com `previsto: true`.
- As parcelas **nunca** viram item à parte.
- Dívida `origem: "banco"` usa `parcelaMinima` até `parcelasRestantes`. Dívida manual usa o pagamento do plano, como `compromissosDoMes`, só no 1º mês e depois repetido até quitar pela simulação.

- [ ] **Step 1: Teste que falha:**
  - aluguel 120000 + cartão com fatura aberta de 123000 em dez + parcelada de 10x 48000 com 7 restantes:
    - dezembro tem item fatura 123000 e **nenhum** item com o nome da parcelada;
    - janeiro tem fatura 48000 `previsto: true`;
    - o mês da 10ª parcela tem `terminam` com o nome da parcelada;
  - dívida do banco com `parcelaMinima: 61000, parcelasRestantes: 2` aparece em 2 meses e some no 3º, que lista o nome em `terminam` do 2º;
  - com renda 280000, `sobra = 280000 − total`;
  - sem renda, `renda` e `sobra` são `null`.
- [ ] **Step 2:** Rodar e confirmar que FALHA.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Rodar e confirmar que PASSA.
- [ ] **Step 5:** Commit `feat(finance): visão dos próximos meses`.

### Task 8: Banco de dados e repositório

**Files:**
- Modify: `prisma/schema.prisma`, `src/lib/desafoga/servidor/repositorio.ts`, `src/services/tipos.ts` (reexportar tipos do banco), `src/lib/finance/tipos.ts` (Divida)
- Create: migração `prisma/migrations/<ts>_bancos_conectados`
- Test: `src/lib/desafoga/servidor/banco.integracao.test.ts` (novo `describe`)

**Interfaces:**
- **Modelos** (spec 6.1):
  - `ConexaoBancaria`: `pluggyItemId String? @unique`, `sincronizandoDesde DateTime?`, `cpfDoTitular String?`, `ultimoPedidoDeAtualizacao DateTime?`.
  - `ContaBancaria`.
  - `Movimento`: `pluggyId @unique`, índice `[pessoaId, data]`, `pessoaId` desnormalizado.
  - `CompraParcelada`: `chave` única por pessoa.
  - `SugestaoDoBanco`: `@@unique([pessoaId, chave])`, `dados Json`, `situacao`.
  - `RegraDoBanco`.
  - Novos campos:
    - `Pessoa.modoComprasDoBanco String @default("revisar")`;
    - `Compra`: `emocao Int?`, `necessidade String?`, `parcelas Int?`, `valorDaParcela Int?`, `parceladaId String?`;
    - `Divida`: `origem String @default("manual")`, `pluggyLoanId String? @unique`, `instituicao String?`, `cet Float?`, `parcelasRestantes Int?`, `temSeguro Boolean @default(false)`, `atualizadaEm DateTime?`, `confira String[]`, `correcoes Json?`;
    - `Fatura`: `pluggyBillId String? @unique`, `foraDosCalculos Boolean @default(false)`;
    - `Meta.investimentos String[]` (entrega 2 usa; criar já para evitar outra migração).
- **Divida (TS)** ganha:
  - `origem: "manual" | "banco"`, `instituicao: string | null`, `cet: number | null`;
  - `parcelasRestantes: number | null`, `temSeguro: boolean`, `confira: CampoDaDivida[]`;
  - `correcoes: Partial<Record<CampoDaDivida, number>>`.
  - **Na leitura**, campos com correção usam o valor corrigido.
- **Repositório** (todas recebem `pessoaId` como 1º argumento):
  - **Conexões e contas:** `conexoes(p): Promise<ConexaoBancaria[]>`, `conexaoPorItem(itemId): Promise<{ id; pessoaId } | null>`, `criarConexao(p, { pluggyItemId, banco, logo })`, `atualizarConexao(id, parcial)`, `travarSincronizacao(id): Promise<boolean>` (seta `sincronizandoDesde` se nulo ou com mais de 5 min; **atômico**, com `updateMany` + `where`), `soltarSincronizacao(id)`, `salvarContas(conexaoId, contas)`.
  - **Movimentos:** `movimentos(p, filtro?: { situacao?: SituacaoDoMovimento[] })`, `salvarMovimentos(p, movs: Omit<Movimento, "id">[]): Promise<{ novos: Movimento[] }>` (upsert por `pluggyId`; **não muda `situacao`, `compraId` nem `parceladaId` de quem já existia**), `apagarMovimentos(pluggyIds)`, `mudarMovimento(p, id, parcial)`.
  - **Parceladas:** `parceladas(p)`, `salvarParcelada(p, chave, dados)`, `renomearParcelada(p, id, nome, categoria?)` (atualiza também a Compra ligada).
  - **Sugestões:** `sugestoes(p)`, `salvarSugestao(p, chave, tipo, dados)` (não reabre as dispensadas ou aceitas), `mudarSugestao(p, chave, situacao)`.
  - **Regras e modo:** `regras(p)`, `salvarRegra(p, regra)`, `modoCompras(p)`, `salvarModoCompras(p, modo)`.
  - **Dívida do banco:** `salvarDividaDoBanco(p, s: SugestaoDeDivida)` (upsert por `pluggyLoanId`; preserva `correcoes`), `desvincularDivida(p, id)`, `corrigirDivida(p, id, campo, valor)`.
  - **Apagar:** `apagarConexao(p, id): Promise<string | null>` (devolve o `pluggyItemId`; apaga contas, movimentos não registrados e parceladas sem compra; dívidas do banco viram `origem: "manual"`).

- [ ] **Step 1:** Editar o schema e gerar a migração com `--create-only`. Conferir que o SQL só tem `CREATE` e `ALTER ... ADD` (o `ALTER COLUMN ... DROP NOT NULL` de `emocao`/`necessidade` também é aditivo). Aplicar.
- [ ] **Step 2: Teste de integração que falha:**
  - `salvarMovimentos` duas vezes com os mesmos `pluggyId` → `novos` vazio na 2ª;
  - mudar a situação para `"ignorada"` e salvar de novo → continua `"ignorada"`;
  - `travarSincronizacao` duas vezes → `true`, depois `false`;
  - `salvarDividaDoBanco` + `corrigirDivida(..., "taxaMensal", 0.04)` + `salvarDividaDoBanco` de novo com taxa 0.5 → a leitura dá 0.04;
  - `apagarConexao` mantém a Compra ligada e a dívida vira manual.
- [ ] **Step 3:** Rodar com `pnpm db:up` ativo e confirmar que FALHA.
- [ ] **Step 4:** Implementar o repositório.
- [ ] **Step 5:** Rodar e confirmar que PASSA. Depois `pnpm test` completo.
- [ ] **Step 6:** Commit `feat(banco): tabelas e repositório dos bancos conectados`.

### Task 9: Sincronização

**Files:**
- Create: `src/lib/banco/sincronizar.ts`
- Modify: `src/lib/assistente/textos.ts` (texto da Luana), `src/services/tipos.ts` (`TipoAviso` + `"compra-banco"`), `src/components/desafoga/avisos.tsx` (ícone `CreditCard`)
- Test: `src/lib/banco/sincronizar.integracao.test.ts`

**Interfaces:**
- Consumes: Tasks 1–5 e 8; `repo.criarAviso`/`guardarMensagens` (já existem); `materializar`/`Fatura` existentes para gravar a fatura do cartão
- Produces:
  ```ts
  export interface ResultadoDaSincronizacao { contas: number; novos: number; paraRevisar: number; automaticas: number; sugestoes: number; erro: string | null }
  export async function sincronizar(conexaoId: string, o?: { cliente?: ClientePluggy; agora?: Date; pedirAtualizacao?: boolean }): Promise<ResultadoDaSincronizacao>;
  export function mensagemDeCompraDoBanco(item: string, valor: number): string; // textos.ts: "Vi {valor} em {item} agora. Como você estava? Toque para registrar."
  ```

**Passos** (spec 6.2):
1. Pegar a trava; se não conseguir, sai com `erro: null, novos: 0`.
2. Ler o item. `LOGIN_ERROR`, `WAITING_USER_ACTION` e `OUTDATED` → `status: "reconectar"` e sai.
3. Ler contas e identidade.
4. Ler transações. `criadasDesde` = `ultimaSincronizacao − 1 dia`; na primeira, sem filtro.
5. Normalizar → classificar → `paresDeTransferencia`.
6. `salvarMovimentos`.
7. Para os **novos** de natureza `compra`, por ordem:
   - parcelada: liga à `CompraParcelada` pela chave e cria a parcelada se não existir;
   - compra manual correspondente → `situacao: "registrada"`, com `compraId`;
   - fora da janela de 7 dias → `historico`;
   - modo `desligado` → `historico`;
   - modo `automatico` → cria Compra (`via: "banco"`, sem emoção, `situacao: "automatica"`);
   - modo `revisar` → `situacao: "revisar"`, com **um** aviso `compra-banco` e **uma** mensagem da Luana no chat do app. Se a parcelada já tem compra ou já gerou aviso, nada.
8. Empréstimos → `sugestaoDoEmprestimo`. Se já existe dívida com aquele `pluggyLoanId`, `salvarDividaDoBanco`; senão `salvarSugestao`. Contas com cheque especial: o mesmo. **Rotativo:** se a fatura de um cartão venceu (`vencimento` < hoje) e os `pagamento-fatura` entre o fechamento e hoje somam menos que o total, cria a sugestão `rotativo:<contaId>:<mes>` com `tipo: "cartao"`, `saldo` = o que faltou, `taxaMensal: null` e `confira: ["taxaMensal"]`.
9. Faturas: para cada cartão, grava ou atualiza a `Fatura` do mês da fatura aberta (`pluggyBillId` = id da fatura, ou `"aberta:" + contaId + mes`) com `Lancamento`s das compras daquele mês e os encargos (juros/iof das transações; `financeCharges` só se não houver nenhum).
10. Grava `ultimaSincronizacao`, `status: "ok"`, solta a trava.

**Erros:** qualquer exceção → `status: "erro"`, `erro: mensagem curta`, trava solta, nada apagado.
**Atualização na Pluggy:** `pedirAtualizacao: true` chama `cliente.pedirAtualizacao` só se `ultimoPedidoDeAtualizacao` tem mais de 1 h.

- [ ] **Step 1: Testes de integração que falham** (com `clienteFalso()` e `agora = 2026-11-17T15:00-03:00`):
  - (a) a 1ª sincronização cria 2 contas e 50 movimentos; os de revisão são só os de data ≥ 2026-11-10; o número de avisos `compra-banco` é igual ao de movimentos em `revisar`;
  - (b) rodar de novo não cria nada (`novos: 0`, mesma contagem de avisos e mensagens);
  - (c) com `modo = "automatico"`, os da janela viram Compras com `emocao: null` e `via: "banco"`;
  - (d) com `modo = "desligado"`, zero avisos;
  - (e) cria 1 sugestão de dívida `emprestimo:<id>`; aceita (dívida criada), a 2ª sincronização atualiza a dívida e não cria sugestão;
  - (f) `clienteFalso({ falhar: true })` → `status: "erro"` e os movimentos existentes continuam;
  - (g) uma transação com `status: "PENDING"` que volta `POSTED` com outro valor atualiza o valor e não cria aviso novo; um id em `transactions/deleted` (simulado com `apagarMovimentos`) remove o aviso pendente;
  - (h) uma compra manual de 8990 no mesmo dia do "SMART FIT" fica `registrada`, sem aviso;
  - (i) uma parcelada com parcelas 1..3 vistas gera 1 `CompraParcelada` e no máximo 1 aviso.
- [ ] **Step 2:** Rodar e confirmar que FALHA.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Rodar e confirmar que PASSA. Depois `pnpm test` completo.
- [ ] **Step 5:** Commit `feat(banco): sincronização com a Pluggy`.

### Task 10: Ações da API, serviço, webhook e limpeza da demo

**Files:**
- Modify: `src/lib/desafoga/servidor/rotas.ts`, `src/services/contratos.ts`, `src/services/api/index.ts`, `src/services/index.ts`, `src/lib/desafoga/servidor/sessao.ts` (limpeza)
- Create: `src/app/api/pluggy/webhook/route.ts`
- Test: `src/lib/desafoga/servidor/banco.integracao.test.ts` (ações), `src/app/api/pluggy/webhook/route.test.ts`

**Interfaces:**
- **Ações** (validação zod; escrita com `exigirAPropriaPessoa`; leitura com `exigirVer` + `compartilharContas`):

  | Ação | Argumentos | Retorno / comportamento |
  |---|---|---|
  | `banco.listar` | `[p]` | `{ compartilhadas, configurado: pluggyConfigurado(), modo, conexoes, movimentos, parceladas, sugestoes }`. Movimentos: só os últimos 120 dias e todos em `revisar`. |
  | `banco.tokenDeConexao` | `[p, itemId?]` | `{ token, incluirSandbox }`. `incluirSandbox` = `PLUGGY_SANDBOX === "1"` ou espaço DEMO. Em DEMO, recusa se já há 1 conexão Pluggy. |
  | `banco.conectado` | `[p, itemId]` | Cria a conexão, sincroniza e devolve o `ResultadoDaSincronizacao`. |
  | `banco.atualizar` | `[p, conexaoId]` | Sincroniza com `pedirAtualizacao: true`. |
  | `banco.desconectar` | `[p, conexaoId]` | `repo.apagarConexao` e depois `cliente.apagarItem`. Falha na Pluggy só é registrada no log. |
  | `banco.modo` | `[p, modo]` | Aplica a troca de modo da spec 6.5 aos movimentos em `revisar`. |
  | `banco.ignorar` | `[p, movimentoId]` | Muda a situação para `ignorada`. |
  | `banco.marcarTransferencia` | `[p, movimentoId]` | Muda a natureza para `transferencia-propria`, a situação para `ignorada` e grava uma `RegraDoBanco` pela `chaveDaDescricao` ou pelo documento. |
  | `banco.registrar` | `[p, movimentoId, { item, categoria, emocao, necessidade }]` | Cria a Compra `via: "banco"`. Se o movimento é de parcelada, ela usa o valor total e os campos de parcela, fica ligada à parcelada e o nome/categoria da parcelada também mudam. Movimento → `registrada`. Se a categoria mudou em relação à automática, grava regra. |
  | `banco.completarEmocao` | `[p, compraId, emocao, necessidade]` | Para as compras automáticas. |
  | `banco.renomearParcelada` | `[p, parceladaId, nome, categoria?]` | — |
  | `banco.aceitarSugestao` | `[p, chave, correcoes?]` | Dívida → `salvarDividaDoBanco` com as correções. |
  | `banco.dispensarSugestao` | `[p, chave]` | — |
  | `dividas.desvincular` | `[p, dividaId]` | — |
  | `dividas.corrigir` | `[p, dividaId, campo, valor]` | — |
  | `banco.simularCompra` | `[p]` | Só espaço DEMO, senão `SemPermissao`. Cria um movimento na conexão "Banco Demonstração" com uma loja e valor sorteados de uma lista fixa de 6, e dispara o fluxo de aviso e mensagem da Luana. |

- **Serviço:** `BancoService` com um método por ação, mesmos nomes sem o prefixo. `servicos.banco`.
- **Webhook:** `POST /api/pluggy/webhook`.
  - Responde `401` se `?s` ≠ `PLUGGY_WEBHOOK_SEGREDO` ou se `body.clientId` ≠ `PLUGGY_CLIENT_ID`.
  - Responde `200 {ok:true}` imediatamente e, em `after()`:
    - `conexaoPorItem(itemId)` → `sincronizar`;
    - `transactions/deleted` → `apagarMovimentos(transactionIds)`;
    - `item/deleted` → apaga a conexão sem chamar a Pluggy.
  - `itemId` desconhecido → 200 e nada.
- **Limpeza da demo:** antes do `espaco.deleteMany` das demos vencidas e no "sair da demo", buscar os `pluggyItemId` das conexões desses espaços e chamar `apagarItem` em cada um (`Promise.allSettled`).

- [ ] **Step 1: Testes que falham:**
  - a profissional sem `compartilharContas` recebe `compartilhadas: false` e listas vazias;
  - a profissional não consegue `banco.ignorar` (`SemPermissao`);
  - `banco.registrar` de movimento de parcelada cria 1 Compra com `parcelas: 10` e renomeia a parcelada;
  - `banco.marcarTransferencia` cria regra, e a próxima sincronização com a mesma descrição já classifica como transferência;
  - `banco.simularCompra` fora de DEMO lança;
  - webhook com segredo errado → 401; com segredo certo e `itemId` desconhecido → 200.
- [ ] **Step 2:** Rodar e confirmar que FALHA.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Rodar e confirmar que PASSA. Depois `pnpm test` completo.
- [ ] **Step 5:** Commit `feat(banco): ações da API, webhook e limpeza da demo`.

### Task 11: Tela — bancos conectados e janela da Pluggy

**Files:**
- Create:
  - `src/components/desafoga/banco/conectar.tsx` (botão + janela via `dynamic(() => import("react-pluggy-connect").then(m => m.PluggyConnect), { ssr: false })`, remontada com `key` a cada token)
  - `src/components/desafoga/banco/bancos-conectados.tsx`
- Modify: `src/components/desafoga/telas/contas.tsx` (bloco no topo), `src/components/desafoga/telas/perfil.tsx` (atalho), `src/hooks/use-pessoa.ts` (`banco: DadosDoBanco`)

**Interfaces:**
- Consumes: `servicos.banco.*` (Task 10)
- Produces: `DadosDoBanco` (tipo de retorno de `banco.listar`, em `src/services/tipos.ts`) e `<BancosConectados pessoaId dados somenteLeitura />`.

**Comportamento (spec 5.1):**
- **Lista de conexões:**
  - cada conexão mostra status, "atualizado há X", **Atualizar** (desabilitado com o texto "próxima atualização às HH:MM" quando `proximaAtualizacaoPossivel` está no futuro) e menu ⋯ → Desconectar, com confirmação na `Janela`, sem `confirm()`;
  - `status: "reconectar"` → botão **Reconectar** (abre a janela com `updateItem`).
- **Modo das compras:** grupo de 3 opções (`radiogroup`).
- **Ao conectar:** "Lendo seu banco…" e depois o resumo "Achei N contas, X compras desta semana…".
- **Sem a Pluggy configurada** (`configurado: false`): mostra "Conexão com bancos indisponível neste ambiente".
- **Na abertura do app**, se a última sincronização tem mais de 1 h, chama `servicos.banco.atualizar` uma vez por sessão do navegador (`sessionStorage` com try/catch).
- **Foco:** seguir o padrão de foco sem borda dupla (`.caixa-de-campo` / `focus-visible` do `desafoga.css`).

- [ ] **Step 1:** Implementar.
- [ ] **Step 2:** `pnpm typecheck && pnpm lint`.
- [ ] **Step 3: Verificar no navegador** (chrome-devtools MCP, `pnpm dev`, Ana em `/app/contas`):
  - conectar o "Pluggy Bank" com `user-ok` / `password-ok`;
  - ver as 2 contas e o resumo;
  - trocar o modo;
  - desconectar;
  - capturar desktop e celular (390 px).
- [ ] **Step 4:** Commit `feat(banco): conectar bancos pela janela da Pluggy`.

### Task 12: Tela — compras para revisar, registro pré-preenchido e parceladas

**Files:**
- Create: `src/components/desafoga/banco/compras-para-revisar.tsx`, `src/components/desafoga/banco/parcelada.tsx`
- Modify:
  - `src/components/desafoga/registro.tsx`: `useAbrirRegistro()` passa a aceitar `(previa?: PreviaDoRegistro)`
  - `src/components/desafoga/telas/registrar.tsx`: `FluxoDeRegistro` recebe `previa?`
  - `src/components/desafoga/telas/hoje.tsx` (cartão)
  - `src/components/desafoga/telas/orcamento.tsx` e `hoje.tsx`: passar `avulsos` (movimentos `compra` em `revisar`/`historico` sem `compraId`) para `orcamentoDoMes`/`gastoDoMes`, exceto no modo `desligado`

**Interfaces:**
- Produces: `interface PreviaDoRegistro { movimentoId: string; item: string; valor: number; categoria: Categoria; parcelas: number | null }`.
- **Com `previa`**, o passo 1:
  - mostra o valor como texto fixo ("R$ 45,90 · do banco") em vez do campo;
  - deixa o nome editável e a categoria pré-marcada;
  - `concluir` chama `servicos.banco.registrar` em vez de `compras.registrar`;
  - com `parcelas`, mostra "R$ 4.800 em 10x" e o texto "vale para todas as parcelas".

**Cartão "Compras para revisar"** (spec 5.2):
- até 5 linhas (ícone da categoria, nome, valor, quando) com **Registrar**;
- menu com **Ignorar** e **É transferência minha**;
- "ver todas" abre uma `Janela larga` com a lista completa.

**Parcelada** (spec 5.3):
- nome, loja original, data da compra, total, parcelas (✓ pagas / ○ futuras), "última na fatura de …";
- **Renomear** abre `Janela` com nome e categoria.
- Aparece em Contas, numa lista "Compras parceladas".

**Compras automáticas sem emoção:** a lista de compras mostra "sem emoção · completar", que abre a mesma janela no passo da emoção.

- [ ] **Step 1:** Implementar.
- [ ] **Step 2:** `pnpm typecheck && pnpm lint && pnpm test`.
- [ ] **Step 3: Verificar no navegador** (Ana, com o banco de teste conectado):
  - registrar uma compra para revisar, trocando a categoria;
  - ignorar outra;
  - renomear uma parcelada e conferir que todas as parcelas mostram o nome novo;
  - conferir o orçamento somando a compra ainda não revisada;
  - celular e desktop.
- [ ] **Step 4:** Commit `feat(banco): compras para revisar, registro pré-preenchido e parceladas`.

### Task 13: Tela — dívidas do banco e próximos meses

**Files:**
- Create: `src/components/desafoga/banco/sugestoes-de-divida.tsx`, `src/components/desafoga/contas/proximos-meses.tsx`
- Modify:
  - `src/components/desafoga/telas/dividas.tsx` e os componentes em `src/components/desafoga/dividas/*` que listam e editam dívidas;
  - `src/components/desafoga/telas/contas.tsx`;
  - `src/app/(desafoga)/painel/[id]/contas/page.tsx` (somente leitura);
  - `src/components/desafoga/telas/fatura.tsx` e `src/lib/finance/fatura.ts`: `Fatura.foraDosCalculos?: boolean`. `encargosDasFaturas` e `custoEmocional` ignoram as faturas fora dos cálculos.
  - Ao salvar um PDF havendo cartão conectado, a tela pergunta "Esta fatura é de um cartão conectado?". Se sim, grava com `foraDosCalculos: true`. A ação `faturas.salvar` ganha esse argumento opcional.

**Comportamento:**
- **Dívidas** (spec 5.4):
  - sugestões no topo ("Achei N contratos no {banco}" → cartão por contrato com saldo, taxa, parcela, restantes, CET, "tem seguro contratado"; campos `confira` com destaque e campo para corrigir; **Adicionar** e **Agora não**);
  - dívida `origem: "banco"` com selo **do banco**, detalhe estendido e "Falta pagar (com juros)";
  - a edição comum fica bloqueada, exceto corrigir campos `confira`; botão **Desvincular**;
  - dica fixa do Registrato com link `https://registrato.bcb.gov.br` (`target="_blank" rel="noreferrer"`).
- **Próximos meses** (spec 5.5): lista de 12 meses com barra comprometido/renda, itens (fatura com "N parcelas", dívidas, fixas), selo "previsto" e 🎉 "{nome} termina em {mês}". Usar `proximosMeses` da Task 7.

- [ ] **Step 1:** Implementar.
- [ ] **Step 2:** `pnpm typecheck && pnpm lint && pnpm test`.
- [ ] **Step 3: Verificar no navegador:**
  - aceitar a sugestão do consignado do sandbox;
  - corrigir um campo "confira";
  - desvincular;
  - conferir que os Próximos meses não mostram a parcela do cartão fora da fatura;
  - painel da Paula em `/painel/ana/contas`, só leitura.
- [ ] **Step 4:** Commit `feat(banco): dívidas do banco e próximos meses`.

### Task 14: Demonstração da Ana e fechamento

**Files:**
- Modify: `src/fixtures/desafoga/sementes.ts` (tipo `SementeBanco`), `src/fixtures/desafoga/ana.ts`, `src/lib/desafoga/servidor/semente.ts`, `README.md`
- Create: `src/components/desafoga/banco/simular-compra.tsx` (botão, só em DEMO)
- Test: `src/lib/desafoga/servidor/banco.integracao.test.ts` (semente)

**Interfaces:**
- `SementePessoa.banco?: SementeBanco`:
  - uma conexão `pluggyItemId: null`, `banco: "Banco Demonstração"`;
  - contas: corrente, PicPay e cartão;
  - movimentos com datas relativas (`dias`).
- **Conteúdo** (spec 6.7):
  - 3 compras em `revisar` (iFood 45,90 hoje; Pão de Açúcar 132,00 ontem; Shopee 89,90 ontem);
  - "MERCADOLIVRE*CELULAR" 10x de 480,00 com as parcelas 1–3 vistas e a parcelada nomeada "Mercado Livre celular";
  - transferência Nubank → PicPay de 200,00 casada;
  - salário de 2.800,00 todo dia 5 nos últimos 3 meses;
  - Netflix 55,90, Spotify 21,90 e Smart Fit 89,90 nos últimos 3 meses (`historico`);
  - tarifa "PACOTE SERVICOS" de 39,90;
  - boleto pago com `jurosBoleto` 12,40;
  - sugestão de consignado: saldo 18.400,00, 1,9% a.m., parcela 610,00, 36 restantes, `temSeguro: true`;
  - cheque especial usado de 350,00.

- [ ] **Step 1: Teste que falha:** `criarEspacoDemo` gera para a Ana 1 conexão, 3 movimentos em `revisar`, 1 parcelada com 10 parcelas e 2 sugestões abertas. Repetir `materializar` não duplica.
- [ ] **Step 2:** Rodar, confirmar que FALHA, implementar, rodar e confirmar que PASSA.
- [ ] **Step 3:** Botão **Simular compra do banco** no bloco de bancos conectados, só quando o espaço é DEMO. Chama `servicos.banco.simularCompra` e a lista e o sino atualizam sem recarregar a página (`aoMudar`).
- [ ] **Step 4:** README: seção "Bancos conectados (Pluggy)" com as variáveis, o banco de teste (`user-ok` / `password-ok`), o MeuPluggy para dados reais e o limite (empréstimos reais só em produção).
- [ ] **Step 5: Gate completo:**
  - `pnpm test` (0 falhas), `pnpm typecheck`, `pnpm lint`;
  - navegador: entrar como Ana na demo → Hoje mostra "3 compras para revisar" → Simular compra → aviso no sino e mensagem da Luana → registrar → Dívidas mostra as 2 sugestões → Contas mostra Próximos meses.
- [ ] **Step 6:** Commit `feat(banco): demonstração da Ana com banco conectado` e `git push`.
