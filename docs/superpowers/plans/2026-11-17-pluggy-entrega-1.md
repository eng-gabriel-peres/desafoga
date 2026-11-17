# Bancos conectados e documentos — Entrega 1 · Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Conectar bancos pela Pluggy **e** ler documentos (fatura em PDF, extrato, print, Registrato, contrato) para alimentar as mesmas estruturas:
- compras para revisar, com registro pré-preenchido;
- compras parceladas;
- transferências próprias;
- dívidas (uma por contrato, venha de onde vier);
- a visão "Próximos meses";
- uma demonstração que funciona sem banco.

**Architecture:**
- **Regras puras:**
  - em `src/lib/banco/*`: normalizar, classificar, relacionar (transferências, parcelas, compras manuais) e dívidas (sugestão, travas, fusão por fonte);
  - em `src/lib/desafoga/documentos.ts`: conversão dos documentos lidos pela IA nas mesmas estruturas.
- **Duas entradas, um destino:**
  - `sincronizar` (Pluggy, `src/lib/banco/sincronizar.ts`);
  - `receberDocumento` (`src/lib/desafoga/servidor/documentos.ts`).
  - As duas gravam pelo mesmo `repositorio` e usam as mesmas funções de fusão.
- **Ações** `banco.*` / `documentos.*` na API existente, `BancoService` nos serviços, telas em `src/components/desafoga/banco/*`.

**Tech Stack:**
- Next.js 16.4.6 (App Router), React 19, Prisma 7 + Postgres, zod 4, Vitest, Gemini (`src/lib/luana/ler.ts`)
- `pluggy-sdk@0.94.3`
- `react-pluggy-connect@2.12.0`

**Spec:** `docs/superpowers/specs/2026-11-17-pluggy-open-finance-design.md`. Leia as seções 3, 5, 6 e 9 antes de qualquer tarefa.

## Global Constraints

- **Formato dos dados:**
  - valores em **centavos** (Int, sempre positivos, com a direção num campo à parte);
  - datas de dia como `YYYY-MM-DD` no fuso de Brasília (`hojeEmBrasilia()` / `chaveDoDia` de `@/lib/finance`);
  - meses como `YYYY-MM`;
  - taxas como fração ao mês.
- **Código:** nomes de código e textos em **português**, no estilo do projeto.
- **Next 16:** antes de usar `after()` ou criar route handler, ler `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/after.md` e o guia de route handlers.
- **Migrações só aditivas:** `pnpm exec prisma migrate dev --create-only --name <nome>`, conferir o SQL e depois `pnpm exec prisma migrate dev`.
- **Pluggy:**
  - transações só por **`GET /v2/transactions`** (`fetchTransactionsCursor` / `fetchAllTransactions`), nunca `fetchTransactions`;
  - não decidir a direção pelo sinal do `amount`; valor = `Math.round(Math.abs(amount) * 100)`.
- **IA:** a IA **só transcreve** (strings como impressas). Quem converte é o código: `lerValorEmReais` e `lerPercentual` de `src/lib/dinheiro.ts`. Testes nunca chamam a IA: usam `DocumentoLido` montado à mão, como em `src/lib/desafoga/desafoga.test.ts:167`.
- **Uma dívida por contrato:**
  - confiança `pluggy (4) > contrato (3) > registrato (2) > fatura (1) = extrato (1)`;
  - fonte mais confiável atualiza a menos confiável, nunca o contrário;
  - `correcoes` da pessoa nunca são sobrescritas;
  - documentos e Pluggy nunca alteram dívida `origem: "manual"` sem a pessoa vincular.
- **Uma fatura por cartão e mês:** se a Pluggy tem a fatura, ela vence; o PDF só completa campos vazios e fica `foraDosCalculos`.
- **Segredos:**
  - `PLUGGY_CLIENT_ID` e `PLUGGY_CLIENT_SECRET` só no servidor;
  - novos: `PLUGGY_WEBHOOK_SEGREDO`, `PLUGGY_WEBHOOK_URL` (opcional, https), `PLUGGY_SANDBOX` (`"1"` mostra os bancos de teste).
- **Janela de avisos:** só movimentos com `data ≥ conectadaEm − 7 dias` viram aviso ou compra automática.
- **Atualização na Pluggy:** `PATCH /items/{id}` no máximo 1 vez por hora por conexão.
- **Webhook:** 2xx em até 10 s, com o processamento em `after()`.
- **Acesso:** escrita com `exigirAPropriaPessoa`; a profissional lê com `exigirVer` **e** só se `Rotina.compartilharContas`.
- **Gate de cada commit:**
  - `pnpm test > /tmp/t.log 2>&1; grep -E "Tests .*passed|failed" /tmp/t.log` sem falhas;
  - `pnpm typecheck` e `pnpm lint` sem erros.

## Review Focus

1. **Sincronizar ou subir o mesmo documento duas vezes** não duplica nada: movimento, aviso, mensagem da Luana, parcelada, sugestão, dívida ou fatura. Testes nas Tarefas 10 e 11.
2. **A mesma dívida por três caminhos** (Registrato hoje, extrato amanhã, Pluggy depois) termina como **uma** dívida. Os campos ficam com a fonte mais confiável, e a correção da pessoa se mantém. Testes nas Tarefas 5 e 11.
3. **Números absurdos** (do sandbox, como 130.632 parcelas, ou da IA lendo errado, como taxa "145%" ou parcela maior que o saldo) nunca entram em cálculo sem "confira". Testes nas Tarefas 5 e 6.
4. **Primeira conexão com 12 meses** gera no máximo os avisos dos últimos 7 dias. A mesma parcelada vista no PDF e na Pluggy pede emoção uma vez só. Testes nas Tarefas 10 e 11.
5. **Pluggy fora do ar, ou IA devolvendo documento ilegível ou de tipo inesperado:** a conexão fica `erro` e nada que já existia some. O documento é recusado com mensagem clara e não grava nada pela metade. Testes nas Tarefas 10 e 11.

---

### Task 1: Cliente Pluggy e fixtures do sandbox

**Files:**
- Create: `src/lib/banco/pluggy.ts`, `src/lib/banco/cliente-falso.ts`, `src/lib/banco/fixtures/sandbox/{item,accounts,transacoes-conta,transacoes-cartao,loans,bills,identity,investments}.json`
- Modify: `package.json`
- Test: `src/lib/banco/pluggy.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // pluggy.ts — só servidor
  export interface ClientePluggy {
    item(itemId: string): Promise<PluggyItem>;
    contas(itemId: string): Promise<PluggyConta[]>;
    transacoes(contaId: string, desde?: { criadasDesde?: string }): Promise<PluggyTransacao[]>; // percorre o cursor inteiro
    emprestimos(itemId: string): Promise<PluggyEmprestimo[]>;
    faturas(contaId: string): Promise<PluggyFatura[]>;
    identidade(itemId: string): Promise<{ cpf: string | null; nome: string | null }>;
    investimentos(itemId: string): Promise<PluggyInvestimento[]>;
    pedirAtualizacao(itemId: string): Promise<void>; // PATCH /items/{id}
    apagarItem(itemId: string): Promise<void>;
    tokenDeConexao(o: { itemId?: string; clientUserId: string; webhookUrl?: string }): Promise<string>;
  }
  export function pluggyConfigurado(): boolean;
  export function clientePluggy(): ClientePluggy; // singleton com pluggy-sdk
  ```
  - Os tipos `Pluggy*` são reexports do `pluggy-sdk` (Item, Account, Transaction, Loan, CreditCardBills, Investment).
- Produces: `clienteFalso(dados?: Partial<DadosFalsos> & { falhar?: boolean }): ClientePluggy & { chamadas: string[] }`. Por padrão lê as fixtures.

- [ ] **Step 1:** `pnpm add pluggy-sdk@0.94.3 react-pluggy-connect@2.12.0`.
- [ ] **Step 2:** Copiar os JSON de `/private/tmp/claude-501/-Volumes-Volume-1TB-Hackaton-desafoga/d945218e-257e-475c-97f0-3eb82956fef0/scratchpad/pluggy/` para `src/lib/banco/fixtures/sandbox/`, guardando só `results` quando houver. Os nomes ficam: `tx-891f…` → `transacoes-conta.json`, `tx-d2cb…` → `transacoes-cartao.json`, `inv.json` → `investments.json`. **Não copiar `key`.**
- [ ] **Step 3: Teste que falha:**
  - `clienteFalso().transacoes(<cartão>)` devolve 18 itens e `transacoes(<conta>)` devolve 32;
  - `emprestimos()` tem 1 item `"Crédito Pessoal Consignado"`;
  - `pluggyConfigurado()` é `false` sem as variáveis e `true` com ambas (`vi.stubEnv`).
- [ ] **Step 4:** `pnpm vitest run src/lib/banco/pluggy.test.ts` → FALHA.
- [ ] **Step 5:** Implementar:
  - `transacoes` usa `fetchAllTransactions(contaId, { createdAtFrom })`;
  - `tokenDeConexao` usa `createConnectToken(itemId, { clientUserId, webhookUrl, avoidDuplicates: true })`.
- [ ] **Step 6:** Rodar → PASSA.
- [ ] **Step 7:** Commit `feat(banco): cliente Pluggy e respostas do sandbox para testes`.

### Task 2: Tipos comuns e normalização da transação

**Files:**
- Create: `src/lib/banco/tipos.ts`, `src/lib/banco/normalizar.ts`
- Test: `src/lib/banco/normalizar.test.ts`

**Interfaces:**
- Produces (`tipos.ts`, importável no cliente; nada da Pluggy):
  ```ts
  export type ModoCompras = "revisar" | "automatico" | "desligado";
  export type TipoDeContaBancaria = "corrente" | "poupanca" | "cartao";
  export type Natureza = "compra" | "transferencia-propria" | "pagamento-fatura" | "parcela-emprestimo" | "renda" | "tarifa" | "juros" | "iof" | "estorno" | "outra-entrada" | "outra-saida";
  export type SituacaoDoMovimento = "revisar" | "registrada" | "ignorada" | "historico" | "automatica";
  export type StatusDaConexao = "ok" | "atualizando" | "reconectar" | "erro";
  export type FonteDaDivida = "pluggy" | "contrato" | "registrato" | "fatura" | "extrato";
  export const CONFIANCA: Record<FonteDaDivida, number> = { pluggy: 4, contrato: 3, registrato: 2, fatura: 1, extrato: 1 };
  export interface ContaBancaria { id: string; conexaoId: string; pluggyAccountId: string; tipo: TipoDeContaBancaria; nome: string; saldo: number; limite: number | null; limiteDisponivel: number | null; fechamento: string | null; vencimento: string | null; chequeEspecialUsado: number | null; chequeEspecialLimite: number | null }
  export interface ConexaoBancaria { id: string; pluggyItemId: string | null /* null = Banco Demonstração */; banco: string; logo: string | null; status: StatusDaConexao; ultimaSincronizacao: string | null; proximaAtualizacaoPossivel: string | null; consentimentoAte: string | null; conectadaEm: string; contas: ContaBancaria[] }
  export interface MovimentoNovo { pluggyId: string; contaId: string; data: string; descricao: string; descricaoOriginal: string; valor: number; direcao: "saida" | "entrada"; categoriaPluggy: string | null; parcela: number | null; totalParcelas: number | null; valorTotalDaCompra: number | null; compradaEm: string | null; faturaPrevista: string | null; cnpj: string | null; mcc: number | null; documentoContraparte: string | null; jurosBoleto: number | null; pendente: boolean }
  export interface Movimento extends MovimentoNovo { id: string; natureza: Natureza; categoria: Categoria | null; situacao: SituacaoDoMovimento; compraId: string | null; parceladaId: string | null }
  /** Uma compra parcelada vista no banco ou num documento. `origem`: contaId da Pluggy, ou "doc:" + chaveDaInstituicao(emissor) quando o PDF não foi ligado a um cartão conectado. */
  export interface CandidataParcelada { origem: string; descricao: string; valorParcela: number; totalParcelas: number; parcelaAtual: number; mesDaParcela: string /* YYYY-MM em que a parcelaAtual caiu */; valorTotal: number | null; compradaEm: string | null }
  export interface CompraParcelada { id: string; chave: string; origem: string; fonte: "pluggy" | "documento"; nome: string; lojaOriginal: string; categoria: Categoria; valorTotal: number; valorParcela: number; totalParcelas: number; mesDaPrimeira: string; compradaEm: string; compradaEmEstimada: boolean; compraId: string | null; parcelasVistas: number[] }
  export type CampoDaDivida = "saldo" | "taxaMensal" | "parcelaMinima" | "parcelasRestantes";
  export interface SugestaoDeDivida { chave: string; fonte: FonteDaDivida; pluggyLoanId: string | null; tipo: TipoDivida; nome: string; instituicao: string; detalhe: string; saldo: number; vencido: number | null; taxaMensal: number | null; parcelaMinima: number; vencimento: number | null; parcelasRestantes: number | null; cet: number | null; temSeguro: boolean | null; faltaPagarComJuros: number | null; confira: CampoDaDivida[] }
  ```
- Produces (`normalizar.ts`): `tipoDaConta(a)`, `normalizarConta(a): Omit<ContaBancaria, "id" | "conexaoId">`, `normalizarTransacao(t, tipo: TipoDeContaBancaria): MovimentoNovo`, `candidataDoMovimento(m: MovimentoNovo): CandidataParcelada | null`.

**Regras:**
- **Direção:**
  - conta corrente/poupança: `DEBIT` → saída, `CREDIT` → entrada;
  - cartão: entrada só com `/PAGAMENTO|PGTO|ESTORNO|REEMBOLSO|CREDITO DE/i`, o resto é saída.
- `data`: dia de Brasília. `compradaEm`: de `purchaseDate` ou `transactionDateTime`.
- `documentoContraparte`: só dígitos, ou null. `jurosBoleto`: `interestAmount + penaltyAmount` em centavos.
- `candidataDoMovimento`: `origem = contaId`, `mesDaParcela = mês de data`.

- [ ] **Step 1: Teste que falha:**
  - `"NETFLIX.COM"` do cartão → `{ direcao: "saida", valor: 5590, parcela: 2, totalParcelas: 6, valorTotalDaCompra: 33540, mcc: 5812 }`;
  - `"CONDOMINIO EDIFICIO SOLAR"` → `{ direcao: "saida", valor: 80000, data: "2026-11-05" }`;
  - `CREDIT` positivo da conta → entrada;
  - `normalizarConta(<cartão>)` → `{ tipo: "cartao", limite: 30000000, fechamento: "2026-11-17", vencimento: "2026-11-22" }`;
  - `candidataDoMovimento(<netflix>)` → `{ parcelaAtual: 2, totalParcelas: 6, valorParcela: 5590 }`.
- [ ] **Step 2:** Rodar → FALHA. **Step 3:** Implementar. **Step 4:** Rodar → PASSA.
- [ ] **Step 5:** Commit `feat(banco): tipos comuns e normalização das transações`.

### Task 3: Classificação (natureza e categoria)

**Files:**
- Create: `src/lib/banco/classificar.ts`, `src/lib/banco/lojas.ts`
- Test: `src/lib/banco/classificar.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface RegraDoBanco { padrao: string; efeito: { categoria: Categoria } | { natureza: "transferencia-propria" } | { ignorar: true } }
  /** Maiúsculas, sem acento, sem tudo que não é letra/número, sem marcadores de parcela ("3/10", "PARC 03/10", "03 DE 10"). */
  export function chaveDaDescricao(descricao: string): string;
  export function naturezaDe(m: MovimentoNovo, ctx: { cpfDoTitular: string | null; regras: RegraDoBanco[] }): Natureza;
  export function categoriaDe(m: Pick<MovimentoNovo, "descricao" | "mcc" | "categoriaPluggy">, regras: RegraDoBanco[]): Categoria;
  export const PARCELA_DE_EMPRESTIMO: RegExp; // /PARC.*EMPR|EMPREST|CONSIG|FINANC|CREDITO PESSOAL|CDC/i — usado também pelos documentos
  ```
- Produces (`lojas.ts`): `LOJAS: [RegExp, Categoria][]` (cerca de 60 marcas), `CONTAS_DE_CONSUMO: RegExp`, `MCC_PARA_CATEGORIA`.

**Ordem da natureza:**
1. regra;
2. transferência própria (CPF igual, ou `/MESMA TITULARIDADE|ENTRE CONTAS|TRANSF.*PROPRIA/i`);
3. pagamento de fatura;
4. **parcela de empréstimo** (saída em conta corrente/poupança que casa `PARCELA_DE_EMPRESTIMO`);
5. estorno;
6. iof / juros / tarifa;
7. renda;
8. `outra-saida` (contas de consumo);
9. `compra`;
10. `outra-entrada`.

**Ordem da categoria:** regra → LOJAS → MCC → categoria Pluggy → `"Outro"`.

- [ ] **Step 1: Teste que falha** (`it.each`):

  | Entrada | Esperado |
  |---|---|
  | `"IFOOD *RESTAURANTE"` | compra, "Comida pronta" |
  | `"DROGASIL 123"` | "Farmácia" |
  | `"CARREFOUR"` / `"ASSAI ATACADISTA"` | "Mercado" |
  | `"RENNER"` | "Roupa" |
  | `"NETFLIX.COM"` / `"SPOTIFY AB"` / `"SMART FIT ACADEMIA"` | "Lazer" |
  | mcc 5912 | "Farmácia" |
  | desconhecido | "Outro" |
  | `"ELETROBRAS LIGHT SA"` | outra-saida |
  | `"PGTO FATURA NUBANK"` | pagamento-fatura |
  | `"PARC EMPREST 05/24"` e `"CONSIGNADO INSS"` na conta | parcela-emprestimo |
  | `"IOF COMPRA EXTERIOR"` | iof |
  | `"ESTORNO SHOPEE"` no cartão | estorno |
  | `"SALARIO EMPRESA X"` | renda |

  Mais quatro casos:
  - CPF igual → transferencia-propria;
  - regra de transferência vence;
  - regra de categoria vence LOJAS;
  - `chaveDaDescricao("MERCADOLIVRE*CELULAR 03/10") === chaveDaDescricao("MERCADO LIVRE CELULAR PARC 04/10")`.
- [ ] **Step 2:** FALHA. **Step 3:** Implementar. **Step 4:** PASSA.
- [ ] **Step 5:** Commit `feat(banco): classificação de natureza e categoria`.

### Task 4: Relacionar (transferências em par, parceladas de qualquer fonte, compras manuais)

**Files:**
- Create: `src/lib/banco/relacionar.ts`
- Test: `src/lib/banco/relacionar.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export function paresDeTransferencia(movs: Pick<Movimento, "pluggyId" | "contaId" | "data" | "valor" | "direcao" | "natureza">[]): string[];
  /** Mês em que a parcela 1 caiu: mesDaParcela − (parcelaAtual − 1). */
  export function mesDaPrimeira(c: CandidataParcelada): string;
  /** `${origem}|${chaveDaDescricao}|${totalParcelas}|${valorParcela}|${mesDaPrimeira}` */
  export function chaveDaParcelada(c: CandidataParcelada): string;
  /** Mesma compra parcelada: mesma origem, mesma chaveDaDescricao, mesmo totalParcelas, valorParcela a ±5 centavos e mesDaPrimeira a ±1 mês. */
  export function encontrarParcelada(existentes: CompraParcelada[], c: CandidataParcelada): CompraParcelada | null;
  /** Nova parcelada a partir da candidata. valorTotal = c.valorTotal ?? valorParcela × totalParcelas. Sem compradaEm: dia 1 de mesDaPrimeira, com compradaEmEstimada = true. */
  export function novaParcelada(c: CandidataParcelada, categoria: Categoria, fonte: "pluggy" | "documento"): Omit<CompraParcelada, "id">;
  export function compraManualCorrespondente(alvo: { valor: number; data: string; parcelada: { valorTotal: number; valorParcela: number; compradaEm: string } | null }, compras: Compra[], jaLigadas: Set<string>, folgaEmDias: 1 | 3): Compra | null;
  ```

**Regras de correspondência** (spec 6.5):
- valor ±50 centavos e data dentro da folga;
- parcelada: compra manual ≈ total (±1%) ou = parcela, a até 3 dias de `compradaEm`.
- Os documentos usam as mesmas funções.

- [ ] **Step 1: Teste que falha:**
  - transferência em par: Nubank saída 200 / PicPay entrada 200 no dia seguinte → par; com 4 dias de distância → nada; mesma conta → nada;
  - parcela 3/10 vista em nov e 4/10 vista em dez → mesmo `mesDaPrimeira` (`"2026-09"`) e mesma chave;
  - `encontrarParcelada` acha a mesma compra quando o PDF diz 03/10 em nov e a Pluggy 04/10 em jan (diferença de 1 mês) e **não** acha quando o total de parcelas é diferente;
  - `novaParcelada` sem `valorTotal` → `48000 × 10`, `compradaEmEstimada: true`;
  - manual 3500 casa com 3550; não casa com 3600; com 2 dias de distância só casa na folga 3;
  - manual 480000 casa com parcelada de total 480000; compra em `jaLigadas` nunca casa.
- [ ] **Step 2:** FALHA. **Step 3:** Implementar. **Step 4:** PASSA.
- [ ] **Step 5:** Commit `feat(banco): transferências em par, parceladas de qualquer fonte e compras manuais`.

### Task 5: Dívidas — sugestão da Pluggy, travas e fusão por fonte

**Files:**
- Create: `src/lib/banco/dividas.ts`, `src/lib/banco/instituicoes.ts`
- Test: `src/lib/banco/dividas.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // instituicoes.ts
  export function chaveDaInstituicao(nome: string): string; // "ITAÚ UNIBANCO S.A." / "Banco Itaú Consignado" → "itau"; ~25 bancos conhecidos; senão sem acento, sem BANCO/S.A./S/A/LTDA, minúsculo, sem espaços
  // dividas.ts
  export const TRAVAS = { taxaMensalMax: 0.3, parcelasMax: 480 } as const;
  export function taxaMensalDe(r: { valor: number; periodicidade: "MONTHLY" | "YEARLY" }): number; // YEARLY → (1+r)^(1/12) − 1
  export function aplicarTravas(s: SugestaoDeDivida): SugestaoDeDivida; // marca em `confira` e anula os campos absurdos (taxa > 30% a.m., parcelas > 480 ou ≤ 0, parcela > saldo × 2, valor negativo)
  export function sugestaoDoEmprestimo(l: PluggyEmprestimo, instituicao: string): SugestaoDeDivida | null;
  export function sugestaoDoChequeEspecial(c: ContaBancaria, instituicao: string): SugestaoDeDivida | null;
  export function chaveDaDivida(s: Pick<SugestaoDeDivida, "instituicao" | "tipo" | "parcelaMinima">): string; // `${chaveDaInstituicao}|${tipo}` + (parcela > 0 ? `|${parcela}` : "")
  /** Mesma instituição e tipo; se as duas têm parcela, diferença ≤ 2%; se uma não tem, casa (com várias candidatas, a de saldo mais próximo). */
  export function encontrarDivida<T extends Pick<SugestaoDeDivida, "instituicao" | "tipo" | "parcelaMinima" | "saldo">>(existentes: T[], nova: SugestaoDeDivida): T | null;
  /** Junta a nova leitura na existente: campo a campo, a fonte de confiança ≥ substitui valores não nulos; a de confiança menor só preenche o que está nulo ou em `confira`. Mantém a chave da existente; `fonte` vira a mais confiável; `confira` é recalculado. */
  export function fundirDivida(existente: SugestaoDeDivida, nova: SugestaoDeDivida): SugestaoDeDivida;
  ```

**Regras da Pluggy** (spec 6.4):
- `saldo`, nesta ordem:
  1. `contractOutstandingBalance` coerente (> parcela e ≤ `totalRemainingAmount`);
  2. valor presente das parcelas restantes;
  3. `totalRemainingAmount` com "confira".
- `kind`: `FINANCING` → `"parcelamento"`; `UNARRANGED_ACCOUNT_OVERDRAFT` → `"cheque"`; o resto → `"emprestimo"`.
- `fonte: "pluggy"`.

- [ ] **Step 1: Teste que falha:**
  - fixture do sandbox: taxa ≈ `0.03994`; `parcelaMinima 100004`; `temSeguro: true`; `cet 0.29`; `faltaPagarComJuros 2850004`; `parcelasRestantes` ≤ 480 e ≠ 14600 e ≠ 130632; `saldo` entre 0 e 2850004;
  - `aplicarTravas` com taxa 1.45 → `taxaMensal: null`, `"taxaMensal"` em `confira`;
  - cheque especial com 50000 usado → `tipo "cheque"`, taxa em `confira`; com 0 → `null`;
  - `chaveDaInstituicao("ITAÚ UNIBANCO S.A.") === chaveDaInstituicao("Banco Itaú Consignado") === "itau"`;
  - **fusão Registrato → Pluggy:** sugestão Registrato `{ instituicao: "ITAU UNIBANCO", tipo: "emprestimo", saldo: 1850000, parcelaMinima: 0, taxaMensal: null, confira: [...] }` + a da Pluggy do mesmo banco → `encontrarDivida` acha. `fundirDivida` fica com a taxa e a parcela da Pluggy, `fonte: "pluggy"`, e a chave da existente;
  - **fusão ao contrário** (Pluggy existente + extrato novo com parcela diferente): nada muda, porque a confiança é menor;
  - extrato traz `parcelasRestantes` quando a existente tinha null: preenche.
- [ ] **Step 2:** FALHA. **Step 3:** Implementar. **Step 4:** PASSA.
- [ ] **Step 5:** Commit `feat(banco): dívidas sugeridas, travas e fusão por fonte`.

### Task 6: Documentos — leitura ampliada e conversão para as mesmas estruturas

**Files:**
- Modify:
  - `src/lib/luana/ler.ts`: schema e prompt
  - `src/lib/luana/lancamentos.ts`: `NATUREZAS` + `"parcela_emprestimo"`
  - `src/lib/desafoga/fatura-lida.ts`
  - `src/lib/finance/tipos.ts`: `Fatura`, `TipoLancamento`, `Lancamento`
  - `src/lib/finance/fatura.ts`
- Create: `src/lib/desafoga/documentos.ts`, `src/fixtures/desafoga/documentos-de-exemplo.ts`
- Test: `src/lib/desafoga/documentos.test.ts`, ajustar `src/lib/desafoga/desafoga.test.ts` e `src/lib/finance/fatura.test.ts`

**Interfaces:**
- **Leitura** (`ler.ts`):
  - `DocumentoLido.tipo` ganha `"registrato" | "contrato_emprestimo"`.
  - Campo novo `dataBase: string | null` ("AAAA-MM" do Registrato).
  - Campo novo `contratos: ContratoLido[]` (vazio nos outros tipos):
    ```ts
    const ContratoLido = z.object({ instituicao: z.string(), modalidade: z.string(), aVencer: z.string().nullable(), vencido: z.string().nullable(), saldoDevedor: z.string().nullable(), valorParcela: z.string().nullable(), parcelasPagas: z.string().nullable(), parcelasRestantes: z.string().nullable(), totalParcelas: z.string().nullable(), taxaMensal: z.string().nullable(), taxaAnual: z.string().nullable(), cet: z.string().nullable(), seguro: z.boolean().nullable(), proximoVencimento: z.string().nullable() });
    ```
  - O prompt descreve:
    - Registrato: "Relatório de Empréstimos e Financiamentos (SCR) do Banco Central: uma linha por instituição e modalidade, com valores a vencer e vencidos";
    - contrato ou print da tela do empréstimo;
    - `parcela_emprestimo`: "débito de parcela de empréstimo, consignado ou financiamento".
- **Fatura (TS):**
  - `Fatura` ganha `vencimento: string | null`, `total: number | null`, `pagamentoMinimo: number | null`, `taxaRotativoMensal: number | null`, `contaId: string | null`, `fonte: "documento" | "pluggy"`, `foraDosCalculos: boolean`;
  - `TipoLancamento` + `"parcela_emprestimo"`;
  - `Lancamento` ganha `parcela?: number; totalParcelas?: number`.
- **`paraFatura`:**
  - preenche os números (`lerValorEmReais`, `lerPercentual`);
  - `mes` = mês do `vencimento` quando houver (senão o atual);
  - `parcela_emprestimo` vira `TipoLancamento "parcela_emprestimo"`;
  - `"03/06"` é lido para `parcela`/`totalParcelas`.
- **`fatura.ts`:**
  - `separarFatura`, `encargosDasFaturas` e `custoEmocional` ignoram `parcela_emprestimo` e faturas `foraDosCalculos`;
  - nova `fundirFaturas(pluggy: Fatura, doc: Fatura): { pluggy: Fatura; doc: Fatura }`: o doc fica `foraDosCalculos: true` e copia para a da Pluggy só `vencimento`, `total`, `pagamentoMinimo` e `taxaRotativoMensal` que estiverem nulos lá.
- **Produces** (`documentos.ts`):
  ```ts
  export function tipoDaModalidade(texto: string): { tipo: TipoDivida; detalhe: string }; // CONSIGN→emprestimo "Consignado"; CHEQUE ESPECIAL/ADIANTAMENTO A DEPOSITANTE→cheque; CART/ROTATIV→cartao; VEICULO/IMOVEL/FINANCIAMENTO→parcelamento; PESSOAL/EMPRESTIMO/CDC→emprestimo; senão outra
  export function sugestoesDoRegistrato(doc: DocumentoLido): SugestaoDeDivida[]; // uma por contrato lido; saldo = aVencer + vencido; vencido destacado; taxaMensal/parcelaMinima/parcelasRestantes em confira; fonte "registrato"
  export function sugestaoDoContrato(doc: DocumentoLido): SugestaoDeDivida | null; // fonte "contrato"; taxa = taxaMensal ou de taxaAnual; parcelasRestantes = restantes ou total − pagas; passa por aplicarTravas
  export function parceladasDoDocumento(doc: DocumentoLido, origem: string): CandidataParcelada[]; // lançamentos compra com parcela "x/y"; mesDaParcela = mês do vencimento (ou da data do lançamento)
  export function parcelasDeEmprestimoNosExtratos(extratos: Fatura[], emissores: Record<string, string>): SugestaoDeDivida[]; // agrupa por chaveDaDescricao e valor ±5%; ≥ 2 meses distintos ou 1 com "PARC x/y"; fonte "extrato"; parcelaMinima = valor; parcelasRestantes = y − x se houver; saldo = parcela × restantes com "saldo" em confira (senão 0 + confira); nunca vira compra
  export function sugestaoDeRotativoDaFatura(f: Fatura): SugestaoDeDivida | null; // fatura com lançamento "juros" > 0 e total: saldo = total, taxa = taxaRotativoMensal, parcelaMinima = pagamentoMinimo, tipo "cartao", fonte "fatura"
  ```
- **Exemplos** (`documentos-de-exemplo.ts`):
  - `REGISTRATO_DE_EXEMPLO: DocumentoLido` (3 instituições: Itaú consignado 18.400,00 a vencer; Nubank cartão rotativo 1.230,00 com 410,00 vencido; Caixa financiamento de veículo 22.900,00);
  - `CONTRATO_DE_EXEMPLO: DocumentoLido`.

- [ ] **Step 1: Teste que falha** (documentos montados à mão):
  - **Fatura com números e parcelas:** fatura PDF com `vencimento: "2026-12-10"`, `total: "1.230,00"`, `pagamentoMinimo: "184,50"`, `taxaRotativoMensal: "14,9%"` e lançamento `"MERCADOLIVRE*CELULAR"` `"480,00"` com parcela `"03/10"`:
    - `paraFatura` → `{ mes: "2026-12", total: 123000, pagamentoMinimo: 18450, taxaRotativoMensal: 0.149 }`;
    - o lançamento tem `parcela: 3, totalParcelas: 10`;
    - `parceladasDoDocumento` dá 1 candidata `{ valorParcela: 48000, totalParcelas: 10, parcelaAtual: 3, mesDaParcela: "2026-12" }`.
  - **Registrato** com 3 instituições → 3 sugestões; a do Nubank tem `vencido: 41000` e `tipo: "cartao"`; todas com `"taxaMensal"` em `confira`.
  - **Extratos de 3 meses** com `"PARC EMPREST 05/24"` 61000 (06/24, 07/24) → 1 sugestão `{ parcelaMinima: 61000, parcelasRestantes: 17, fonte: "extrato" }`. Nenhum desses lançamentos conta em `separarFatura(...).novas` nem em `custoEmocional`.
  - **Extrato com 1 mês só, sem "PARC x/y"** → nenhuma sugestão.
  - **Contrato** com taxa `"145%"` ao mês → `taxaMensal: null` e em `confira`. Contrato bom com `"1,99% a.m."`, 24 de 36 pagas → `taxaMensal 0.0199`, `parcelasRestantes 12`.
  - **`fundirFaturas`:** da Pluggy sem `pagamentoMinimo` e do PDF com 18450 → a da Pluggy fica com 18450 e o PDF com `foraDosCalculos: true`; `encargosDasFaturas([pluggy, doc])` não soma o PDF.
- [ ] **Step 2:** FALHA. **Step 3:** Implementar (e ajustar os testes antigos de `paraFatura` aos campos novos). **Step 4:** `pnpm test` completo → PASSA.
- [ ] **Step 5:** Commit `feat(documentos): parcelas, números da fatura, extrato, Registrato e contrato`.

### Task 7: Compra sem emoção, compra parcelada e gastos do mês

**Files:**
- Modify:
  - `src/lib/finance/tipos.ts` (Compra)
  - `orcamento.ts`, `emocao.ts`, `padroes.ts`, `fatura.ts`
  - todo uso de `.emocao`/`.necessidade` (`grep -rn "\.emocao\b\|\.necessidade\b" src`; são ~12 arquivos)
  - `src/services/tipos.ts` (`NovaCompra`)
- Test: `src/lib/finance/orcamento.test.ts`, `emocao.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // Compra:
  emocao: Emocao | null; necessidade: Necessidade | null; via: "app" | "whatsapp" | "fatura" | "banco";
  parcelas: number | null; valorDaParcela: number | null; parceladaId: string | null;
  // orcamento.ts
  export interface GastoAvulso { categoria: Categoria; valor: number; data: string }
  export function valorNoMes(c: Compra, mes: string): number;
  export function gastoDoMes(compras: Compra[], categoria: Categoria, agora: Date, avulsos?: GastoAvulso[]): number;
  export function orcamentoDoMes(orcamentos: Orcamento[], compras: Compra[], agora: Date, avulsos?: GastoAvulso[]): SituacaoDoOrcamento[];
  ```
- Funções de emoção ignoram `emocao === null`; as de necessidade ignoram `necessidade === null`.
- Na UI, `null` mostra o selo "sem emoção".

- [ ] **Step 1: Teste que falha:**
  - `notaMedia([2, null, 4])` = 3;
  - parcelada de 480000 em 10x de 48000, comprada em 2026-05-10 → `valorNoMes` dá 48000 em `"2026-07"` e em `"2027-02"`, e 0 em `"2027-03"` e em `"2026-04"`;
  - `gastoDoMes` com avulso no mês o inclui; avulso de outro mês fica de fora.
- [ ] **Step 2:** FALHA. **Step 3:** Implementar e corrigir os usos até `pnpm typecheck` passar. **Step 4:** `pnpm test` completo → PASSA.
- [ ] **Step 5:** Commit `feat(finance): compra sem emoção, parcelada e gastos avulsos no orçamento`.

### Task 8: Próximos meses (Pluggy e documentos)

**Files:**
- Create: `src/lib/finance/proximos-meses.ts` (exportar no `index.ts`)
- Test: `src/lib/finance/proximos-meses.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface CartaoNoMes { origem: string; nome: string; vencimento: number; faturaAberta: { mes: string; valor: number } | null }
  /** Um cartão por origem: contas cartão conectadas (fatura aberta = Fatura fonte "pluggy" do mês) e faturas de documento ainda não foraDosCalculos (origem "doc:<instituição>" ou contaId quando ligadas). Usa a fatura mais recente de cada origem. */
  export function cartoesDasFontes(contas: ContaBancaria[], faturas: Fatura[]): CartaoNoMes[];
  export interface ItemDoMes { tipo: "conta" | "fatura" | "divida"; nome: string; valor: number; previsto: boolean; detalhe?: string }
  export interface MesComprometido { mes: string; total: number; renda: number | null; sobra: number | null; itens: ItemDoMes[]; terminam: string[] }
  export function proximosMeses(e: { contas: ContaFixa[]; dividas: Divida[]; plano: Plano; parceladas: CompraParcelada[]; cartoes: CartaoNoMes[]; renda: Renda | null }, agora: Date, quantos = 12): MesComprometido[];
  ```

**Regras:**
- Fatura do mês aberto = total real. Meses seguintes = soma das parcelas daquela `origem`, marcadas `previsto`.
- Parcela nunca vira item à parte.
- Dívida do banco ou de documento com `parcelasRestantes` usa `parcelaMinima` até acabar. Dívida manual segue o plano.

- [ ] **Step 1: Teste que falha:**
  - cartão de documento (`origem "doc:nubank"`, fatura dez = 123000) + parcelada da mesma origem 10x 48000 com 7 restantes:
    - dezembro tem a fatura de 123000 e nenhum item com o nome da parcelada;
    - janeiro tem fatura de 48000 `previsto`;
    - no mês da 10ª parcela, `terminam` tem o nome;
  - o mesmo com a origem de um cartão conectado dá o mesmo resultado;
  - dívida `parcelaMinima 61000, parcelasRestantes 2` → 2 meses;
  - renda 280000 → `sobra`; sem renda → `null`.
- [ ] **Step 2:** FALHA. **Step 3:** Implementar. **Step 4:** PASSA.
- [ ] **Step 5:** Commit `feat(finance): visão dos próximos meses`.

### Task 9: Banco de dados e repositório

**Files:**
- Modify: `prisma/schema.prisma`, `src/lib/desafoga/servidor/repositorio.ts`, `src/services/tipos.ts`, `src/lib/finance/tipos.ts` (Divida)
- Create: migração `<ts>_bancos_e_documentos`
- Test: `src/lib/desafoga/servidor/banco.integracao.test.ts` (novo `describe`)

**Interfaces:**
- **Modelos novos:**
  - `ConexaoBancaria`: `pluggyItemId String? @unique`, `sincronizandoDesde`, `cpfDoTitular`, `ultimoPedidoDeAtualizacao`.
  - `ContaBancaria`.
  - `Movimento`: `pluggyId @unique`, `pessoaId`, índice `[pessoaId, data]`.
  - `CompraParcelada`: `@@unique([pessoaId, chave])`, `parcelasVistas Int[]`.
  - `Sugestao`: `@@unique([pessoaId, chave])`, `tipo` (divida / renda), `dados Json`, `situacao` (aberta / aceita / dispensada).
  - `RegraDoBanco`.
- **Campos novos:**
  - `Pessoa.modoComprasDoBanco @default("revisar")`;
  - `Compra`: `emocao Int?`, `necessidade String?`, `parcelas Int?`, `valorDaParcela Int?`, `parceladaId String?`;
  - `Divida`: `origem @default("manual")`, `fonte String?`, `chave String?` (única por pessoa), `pluggyLoanId String? @unique`, `instituicao`, `cet`, `parcelasRestantes`, `temSeguro Boolean?`, `vencido Int?`, `atualizadaEm`, `confira String[]`, `correcoes Json?`;
  - `Fatura`: `pluggyBillId String? @unique`, `fonte @default("documento")`, `contaId String?`, `vencimento String?`, `total Int?`, `pagamentoMinimo Int?`, `taxaRotativoMensal Float?`, `foraDosCalculos @default(false)`;
  - `Lancamento`: `parcela Int?`, `totalParcelas Int?`;
  - `Meta.investimentos String[]`.
- **Divida (TS)** ganha:
  - `origem: "manual" | "banco" | "documento"`, `fonte: FonteDaDivida | null`, `instituicao`, `cet`;
  - `parcelasRestantes`, `temSeguro`, `vencido`, `confira`, `correcoes`.
  - Na leitura, as correções valem.
- **Repositório** (`pessoaId` primeiro):
  - **Conexões e contas:** `conexoes`, `conexaoPorItem`, `criarConexao`, `atualizarConexao`, `travarSincronizacao` (atômico, com `updateMany` + `where`), `soltarSincronizacao`, `salvarContas`.
  - **Movimentos:** `movimentos(p, filtro?)`, `salvarMovimentos(p, movs): Promise<{ novos: Movimento[] }>` (não muda `situacao`/`compraId`/`parceladaId` de quem já existia), `apagarMovimentos`, `mudarMovimento`.
  - **Parceladas:** `parceladas`, `salvarParcelada(p, dados): Promise<{ parcelada: CompraParcelada; nova: boolean }>`, que usa `encontrarParcelada` e acrescenta a parcela vista.
  - **Renomear:** `renomearParcelada` (também atualiza a Compra ligada).
  - **Sugestões e dívidas — `receberSugestaoDeDivida(p, s): Promise<"nova" | "fundida" | "divida-atualizada" | "ignorada">`**, o único caminho para gravar dívida vinda de fonte externa:
    - procura com `encontrarDivida` primeiro entre as dívidas com origem banco/documento e depois entre as sugestões abertas;
    - aplica `fundirDivida`;
    - nunca reabre sugestão dispensada com a mesma chave;
    - não toca dívida manual, mas devolve `"nova"` com `parecidaCom: dividaId` nos dados quando `encontrarDivida` casar com uma manual.
  - **Ações sobre sugestões:** `sugestoes(p)`, `aceitarSugestao(p, chave, correcoes?, vencimento?)` (cria a dívida com `origem` = `fonte === "pluggy" ? "banco" : "documento"`; se a sugestão não tem `vencimento`, o argumento é obrigatório e a tela pede o dia), `vincularSugestao(p, chave, dividaId)` (a dívida manual passa a ter aquela fonte, e os valores manuais diferentes viram `correcoes`), `dispensarSugestao`.
  - **Dívidas:** `desvincularDivida`, `corrigirDivida(p, id, campo, valor)`.
  - **Faturas:** `salvarFatura` (já existe) grava os campos novos. `faturaDoCartao(p, contaId, mes)`.
  - **Demais:** `regras`, `salvarRegra`, `modoCompras`, `salvarModoCompras`, `apagarConexao` (devolve o `pluggyItemId`; dívidas `banco` viram `manual`).

- [ ] **Step 1:** Schema + `--create-only`, conferir que o SQL é só aditivo, aplicar.
- [ ] **Step 2: Testes de integração que falham:**
  - `salvarMovimentos` idempotente;
  - a situação `ignorada` se mantém;
  - trava dupla → `true`/`false`;
  - `receberSugestaoDeDivida` com Registrato e depois Pluggy do mesmo consignado → **1 linha**, primeiro `"nova"` e depois `"fundida"`, com a taxa da Pluggy;
  - depois de aceita, a mesma Pluggy de novo → `"divida-atualizada"`;
  - `corrigirDivida(taxa 0.04)` + nova Pluggy com taxa 0.05 → a leitura dá 0.04;
  - sugestão dispensada não reabre;
  - parecida com dívida manual → `parecidaCom` preenchido e a manual intacta;
  - `apagarConexao` mantém a Compra e converte a dívida para manual.
- [ ] **Step 3:** FALHA (`pnpm db:up` ativo). **Step 4:** Implementar. **Step 5:** PASSA + `pnpm test` completo.
- [ ] **Step 6:** Commit `feat(banco): tabelas e repositório de bancos, documentos e sugestões`.

### Task 10: Sincronização com a Pluggy

**Files:**
- Create: `src/lib/banco/sincronizar.ts`
- Modify: `src/lib/assistente/textos.ts`, `src/services/tipos.ts` (`TipoAviso` + `"compra-banco"` + `"divida-encontrada"`), `src/components/desafoga/avisos.tsx`
- Test: `src/lib/banco/sincronizar.integracao.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface ResultadoDaSincronizacao { contas: number; novos: number; paraRevisar: number; automaticas: number; sugestoes: number; erro: string | null }
  export async function sincronizar(conexaoId: string, o?: { cliente?: ClientePluggy; agora?: Date; pedirAtualizacao?: boolean }): Promise<ResultadoDaSincronizacao>;
  export function mensagemDeCompraDoBanco(item: string, valor: number): string; // "Vi {valor} em {item} agora. Como você estava? Toque para registrar."
  ```

**Passos** (spec 6.2):
1. Pegar a trava.
2. Item: se o status pede ação, `reconectar`.
3. Contas e identidade.
4. Transações incrementais.
5. Normalizar, classificar e casar pares.
6. `salvarMovimentos`.
7. **Novos `compra`:**
   - parcelada: `salvarParcelada` (com `fonte "pluggy"`, `origem = contaId`); se já existe por documento, só acrescenta a parcela;
   - compra manual → `registrada`;
   - fora da janela ou modo `desligado` → `historico`;
   - modo `automatico` → Compra sem emoção;
   - modo `revisar` → 1 aviso + 1 mensagem (parcelada que já tem compra ou aviso, nada).
8. **Novos `parcela-emprestimo`:** ficam `historico` e nunca são compra.
9. **Empréstimos e cheque especial:** `receberSugestaoDeDivida`. Quando o resultado for `"nova"`, cria aviso `divida-encontrada`.
10. **Rotativo:** fatura vencida não paga inteira → sugestão `tipo "cartao"`, `fonte "pluggy"`. Se houver Fatura de documento ligada àquele cartão com `taxaRotativoMensal`, a taxa vem dela (a fusão cuida).
11. **Faturas:** grava ou atualiza a `Fatura` `fonte "pluggy"` do mês aberto de cada cartão, com lançamentos e encargos. Se existe Fatura de documento com o mesmo `contaId` e mês, aplica `fundirFaturas`.
12. `ultimaSincronizacao`, `ok`, soltar a trava.

**Erros:** `status: "erro"` e nada apagado. `pedirAtualizacao` só se passou 1 h.

- [ ] **Step 1: Testes que falham** (`clienteFalso()`, `agora = 2026-11-17T15:00-03:00`):
  - (a) 2 contas e 50 movimentos; revisão só para data ≥ 2026-11-10; nº de avisos = nº em `revisar`;
  - (b) rodar de novo → `novos: 0`, mesmos avisos e mensagens;
  - (c) modo `automatico` → Compras `emocao: null`, `via: "banco"`;
  - (d) modo `desligado` → 0 avisos;
  - (e) sugestão do consignado; aceita → a 2ª sincronização atualiza a dívida e não cria sugestão;
  - (f) `falhar: true` → `erro`, movimentos mantidos;
  - (g) PENDING → POSTED atualiza sem novo aviso; apagado → aviso some;
  - (h) compra manual 8990 no dia do SMART FIT → `registrada`;
  - (i) parcelada já criada por PDF (`fonte "documento"`, mesma origem) + a Pluggy vê a parcela seguinte → **a mesma** `CompraParcelada`, sem aviso novo;
  - (j) fatura de documento do mesmo cartão e mês fica `foraDosCalculos` e a da Pluggy herda o `pagamentoMinimo`;
  - (k) um movimento `"PARC EMPREST 05/24"` na conta não vira compra nem aviso.
- [ ] **Step 2:** FALHA. **Step 3:** Implementar. **Step 4:** PASSA + `pnpm test` completo.
- [ ] **Step 5:** Commit `feat(banco): sincronização com a Pluggy`.

### Task 11: Receber documentos (tela, chat e WhatsApp)

**Files:**
- Create: `src/lib/desafoga/servidor/documentos.ts`
- Modify:
  - `src/lib/desafoga/servidor/acoes.ts`: `lerFatura` vira `lerDocumentoEnviado` (mantendo a exportação antiga como atalho, se outras partes usarem); `receberArquivoNoChat`
  - `src/app/api/desafoga/[acao]/route.ts`: `COM_ARQUIVO` + `"documentos.ler"`
  - `src/lib/desafoga/fatura-lida.ts`: `respostaDaFatura` + respostas para Registrato e contrato
  - `src/lib/desafoga/servidor/rotas.ts`: `faturas.salvar` ganha `contaId?`
- Test: `src/lib/desafoga/servidor/documentos.integracao.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type LeituraDeDocumento =
    | { tipo: "fatura"; fatura: Fatura; parceladas: CandidataParcelada[]; deExemplo: boolean }
    | { tipo: "dividas"; fonte: "registrato" | "contrato"; sugestoes: SugestaoDeDivida[]; deExemplo: boolean };
  /** Lê com a IA (ou o exemplo pedido) e converte. Registrato/contrato: as sugestões já são gravadas por receberSugestaoDeDivida. Fatura/extrato: nada é gravado até salvarDocumento. */
  export async function lerDocumentoEnviado(pessoaId: string, arquivo: { bytes: Uint8Array; mime: string } | null, exemplo?: "fatura" | "registrato" | "contrato"): Promise<LeituraDeDocumento>;
  /** Grava a fatura/extrato com as classificações, as parceladas (salvarParcelada, fonte "documento"; origem = contaId se ligada a cartão conectado, senão "doc:<instituição>"), recalcula parcelasDeEmprestimoNosExtratos e sugestaoDeRotativoDaFatura (→ receberSugestaoDeDivida) e aplica fundirFaturas se houver fatura Pluggy do mesmo cartão e mês. */
  export async function salvarDocumento(pessoaId: string, fatura: Fatura, classificacoes: Record<string, Classificacao>, contaId: string | null): Promise<{ parceladas: number; sugestoes: number }>;
  ```
- **Compras parceladas do PDF:**
  - a compra da 1ª vez em que a parcelada aparece é **uma** só (valor total, campos de parcela), usando a classificação de emoção dada ao lançamento;
  - lançamentos de parcelas seguintes da mesma parcelada não pedem emoção de novo e ligam à compra existente;
  - compra manual correspondente vira o vínculo (folga 3).
- **Chat e WhatsApp** (`receberArquivoNoChat`):
  - Registrato: "Li seu Registrato: N contratos em M instituições, R$ X a vencer e R$ Y vencidos. Confirme em Dívidas.";
  - contrato: "Li o contrato do {instituição}: parcela de R$ X, faltam N. Confirme em Dívidas.";
  - fatura: a mensagem atual + "N compras parceladas".
- **Ações novas:** `documentos.ler` (com arquivo; argumento `exemplo` só em espaço DEMO). `faturas.ler` continua funcionando como atalho de `documentos.ler`.

- [ ] **Step 1: Testes de integração que falham** (com `lerDocumento` substituído por `vi.mock` devolvendo `DocumentoLido` montado à mão; sem IA):
  - Registrato de 3 instituições → 3 sugestões abertas; enviado de novo → continuam 3;
  - Registrato e depois sincronização Pluggy (`clienteFalso`) com o consignado do mesmo banco → **1** sugestão/dívida;
  - fatura PDF com parcela 03/10 salva duas vezes (mesma fatura) → 1 `CompraParcelada`, `parcelasVistas: [3]`, 1 Compra;
  - fatura do mês seguinte com 04/10 → a mesma parcelada, `parcelasVistas: [3, 4]`, sem nova Compra;
  - 3 extratos com PARC EMPREST → 1 sugestão `fonte "extrato"`; o orçamento do mês não muda;
  - documento ilegível → `ArquivoRecusado` e nada gravado;
  - PDF ligado (`contaId`) a um cartão que já tem fatura Pluggy no mês → o PDF fica `foraDosCalculos`.
- [ ] **Step 2:** FALHA. **Step 3:** Implementar. **Step 4:** PASSA + `pnpm test` completo.
- [ ] **Step 5:** Commit `feat(documentos): fatura, extrato, Registrato e contrato alimentam parcelas e dívidas`.

### Task 12: Ações da API, serviço, webhook e limpeza da demo

**Files:**
- Modify: `rotas.ts`, `src/services/contratos.ts`, `src/services/api/index.ts`, `src/services/index.ts`, `src/lib/desafoga/servidor/sessao.ts`
- Create: `src/app/api/pluggy/webhook/route.ts`
- Test: `banco.integracao.test.ts` (ações), `src/app/api/pluggy/webhook/route.test.ts`

**Interfaces:**
- **Ações:**

  | Ação | Argumentos | Comportamento |
  |---|---|---|
  | `banco.listar` | `[p]` | `{ compartilhadas, configurado, modo, conexoes, movimentos (120 dias + todos em revisar), parceladas, sugestoes }` |
  | `banco.tokenDeConexao` | `[p, itemId?]` | `{ token, incluirSandbox }`. Em DEMO, no máximo 1 conexão Pluggy. |
  | `banco.conectado` | `[p, itemId]` | — |
  | `banco.atualizar` | `[p, conexaoId]` | — |
  | `banco.desconectar` | `[p, conexaoId]` | — |
  | `banco.modo` | `[p, modo]` | Transição da spec 6.5. |
  | `banco.ignorar` | `[p, movimentoId]` | — |
  | `banco.marcarTransferencia` | `[p, movimentoId]` | Grava regra. |
  | `banco.registrar` | `[p, movimentoId, { item, categoria, emocao, necessidade }]` | Parcelada → Compra com total, renomeia a parcelada. Categoria trocada → regra. |
  | `banco.completarEmocao` | `[p, compraId, emocao, necessidade]` | — |
  | `banco.renomearParcelada` | `[p, parceladaId, nome, categoria?]` | — |
  | `banco.aceitarSugestao` | `[p, chave, correcoes?, vencimento?]` | — |
  | `banco.vincularSugestao` | `[p, chave, dividaId]` | — |
  | `banco.dispensarSugestao` | `[p, chave]` | — |
  | `dividas.desvincular` | `[p, dividaId]` | — |
  | `dividas.corrigir` | `[p, dividaId, campo, valor]` | — |
  | `banco.simularCompra` | `[p]` | Só DEMO. |
  | `documentos.salvar` | `[p, fatura, classificacoes, contaId \| null]` | — |

- **Serviço:** `BancoService` e `DocumentosService` (`ler`, `salvar`), em `servicos.banco` e `servicos.documentos`.
- **Webhook:**
  - segredo na query e `clientId`, senão 401;
  - 200 imediato;
  - em `after()`: `sincronizar`, `transactions/deleted` e `item/deleted`.
- **Limpeza da demo:** apagar os itens na Pluggy dos espaços DEMO vencidos e no "sair da demo" (`Promise.allSettled`).

- [ ] **Step 1: Testes que falham:**
  - profissional sem `compartilharContas` → `compartilhadas: false`;
  - profissional não consegue `banco.ignorar` nem `documentos.salvar`;
  - `banco.registrar` com parcelada → 1 Compra `parcelas: 10`;
  - `marcarTransferencia` → a próxima sincronização já classifica;
  - `vincularSugestao` → a dívida manual vira `origem "documento"` e o valor manual diferente fica em `correcoes`;
  - `simularCompra` fora de DEMO lança;
  - webhook 401/200.
- [ ] **Step 2:** FALHA. **Step 3:** Implementar. **Step 4:** PASSA + `pnpm test` completo.
- [ ] **Step 5:** Commit `feat(banco): ações da API, webhook e limpeza da demo`.

### Task 13: Tela — bancos conectados e janela da Pluggy

**Files:**
- Create: `src/components/desafoga/banco/conectar.tsx` (`dynamic(() => import("react-pluggy-connect").then(m => m.PluggyConnect), { ssr: false })`, remontada com `key`), `src/components/desafoga/banco/bancos-conectados.tsx`
- Modify: `telas/contas.tsx`, `telas/perfil.tsx`, `src/hooks/use-pessoa.ts` (`banco: DadosDoBanco`)

**Comportamento (spec 5.1):**
- **Lista:**
  - status, "atualizado há X";
  - **Atualizar** (bloqueado com "próxima atualização às HH:MM");
  - ⋯ → Desconectar, com confirmação na `Janela`;
  - **Reconectar** (`updateItem`).
- **Modo das compras:** grupo de 3 opções (`radiogroup`).
- **Ao conectar:** "Lendo seu banco…" e depois o resumo.
- **Sem Pluggy configurada:** aviso de "indisponível". O envio de documentos continua disponível (link "Prefere enviar a fatura ou o Registrato?").
- **Ao abrir o app:** atualiza 1 vez por sessão do navegador se passou 1 h (`sessionStorage` com try/catch).
- **Foco:** padrão sem borda dupla.

- [ ] **Step 1:** Implementar. **Step 2:** `pnpm typecheck && pnpm lint`.
- [ ] **Step 3: Navegador** (chrome-devtools MCP, Ana em `/app/contas`):
  - conectar o Pluggy Bank (`user-ok` / `password-ok`);
  - ver as 2 contas e o resumo;
  - trocar o modo e desconectar;
  - desktop + 390 px.
- [ ] **Step 4:** Commit `feat(banco): conectar bancos pela janela da Pluggy`.

### Task 14: Tela — compras para revisar, registro pré-preenchido e parceladas

**Files:**
- Create: `src/components/desafoga/banco/compras-para-revisar.tsx`, `src/components/desafoga/banco/parcelada.tsx`
- Modify:
  - `registro.tsx`: `useAbrirRegistro()(previa?)`
  - `telas/registrar.tsx`: `FluxoDeRegistro({ fechar, previa? })`
  - `telas/hoje.tsx`, `telas/orcamento.tsx`: `avulsos`
  - `telas/fatura.tsx`: parcelas e números da fatura no resultado; pergunta "De qual cartão conectado é esta fatura?" (lista de cartões + "nenhum") quando houver cartão conectado

**Interfaces:**
- `interface PreviaDoRegistro { movimentoId: string; item: string; valor: number; categoria: Categoria; parcelas: number | null }`.
- Com `previa`:
  - valor fixo ("R$ 45,90 · do banco");
  - nome editável e categoria pré-marcada;
  - salva por `servicos.banco.registrar`;
  - parcelada mostra "R$ 4.800 em 10x" e o texto "vale para todas as parcelas".

**Comportamento:**
- **Cartão "Compras para revisar":** até 5 linhas; **Registrar**; menu com **Ignorar** e **É transferência minha**; "ver todas" abre uma `Janela larga`.
- **Parcelada:**
  - nome, loja original, data da compra (com "aprox." se estimada), total;
  - parcelas ✓/○ e "última na fatura de …";
  - selo da fonte ("do banco" / "da fatura");
  - **Renomear** em `Janela`.
  - Lista "Compras parceladas" em Contas.
- **Resultado da fatura em PDF:**
  - vencimento, total, mínimo e juros do rotativo;
  - parcelas com "3 de 10";
  - parcela já classificada antes aparece como "já registrada (parcelada)".
- **Compras automáticas:** "sem emoção · completar".

- [ ] **Step 1:** Implementar. **Step 2:** `pnpm typecheck && pnpm lint && pnpm test`.
- [ ] **Step 3: Navegador:**
  - registrar uma compra para revisar trocando a categoria;
  - ignorar outra;
  - renomear uma parcelada;
  - subir a fatura de exemplo e ver as parcelas e os números;
  - orçamento somando a compra ainda não revisada;
  - celular e desktop.
- [ ] **Step 4:** Commit `feat(banco): compras para revisar, registro pré-preenchido e parceladas`.

### Task 15: Tela — dívidas de todas as fontes e próximos meses

**Files:**
- Create: `src/components/desafoga/banco/sugestoes-de-divida.tsx`, `src/components/desafoga/contas/proximos-meses.tsx`, `src/components/desafoga/dividas/enviar-documento.tsx` (upload em `Janela`, reaproveitando a área de envio da tela de fatura, com `esperado: "registrato" | "contrato"`)
- Modify: `telas/dividas.tsx`, componentes em `src/components/desafoga/dividas/*`, `telas/contas.tsx`, `src/app/(desafoga)/painel/[id]/contas/page.tsx`

**Comportamento:**
- **Sugestões no topo** ("Achei N dívidas"), cada uma com:
  - selo da fonte ("do banco", "do Registrato", "do contrato", "do extrato", "da fatura");
  - saldo e **vencido em destaque** (`text-bad`);
  - taxa, parcela, restantes, CET e seguro;
  - campos `confira` com campo para completar;
  - ações **Adicionar** e **Agora não**;
  - com `parecidaCom`: "Parece com '{nome}' que você já tem" + **Vincular** / **É outra**.
- **Dívida não manual:**
  - mostra o selo da fonte, "Falta pagar (com juros)" quando houver e "atualizada em";
  - edição comum bloqueada, exceto completar ou corrigir os campos `confira`;
  - botão **Desvincular**.
- **Dica fixa:** "Não lembra de todas? O Registrato do Banco Central mostra todos os seus empréstimos (entra com gov.br)" + link `https://registrato.bcb.gov.br` + botões **Enviar Registrato** e **Enviar contrato ou print**. Em DEMO, a janela de envio oferece "Usar exemplo".
- **Próximos meses:** 12 meses, barra comprometido/renda, itens, selo "previsto", 🎉 "termina em". Usa `cartoesDasFontes` + `proximosMeses`.
- **Painel da profissional:** somente leitura.

- [ ] **Step 1:** Implementar. **Step 2:** `pnpm typecheck && pnpm lint && pnpm test`.
- [ ] **Step 3: Navegador:**
  - enviar o Registrato de exemplo → 3 sugestões, com o vencido do Nubank em destaque;
  - aceitar o consignado;
  - conectar o Pluggy Bank e ver o consignado do sandbox entrar como sugestão separada (é de outro banco) sem duplicar o do Registrato;
  - corrigir um "confira" e desvincular;
  - Próximos meses sem parcela fora da fatura;
  - painel da Paula só leitura.
- [ ] **Step 4:** Commit `feat(dividas): dívidas de banco e documentos, Registrato e próximos meses`.

### Task 16: Demonstração da Ana e fechamento

**Files:**
- Modify: `src/fixtures/desafoga/sementes.ts` (`SementeBanco`), `ana.ts`, `src/lib/desafoga/servidor/semente.ts`, `README.md`
- Create: `src/components/desafoga/banco/simular-compra.tsx`
- Test: `banco.integracao.test.ts` (semente)

**Conteúdo** (spec 6.7 + seção 9):
- **Banco Demonstração** (conexão `pluggyItemId: null`):
  - 3 compras em `revisar`;
  - "MERCADOLIVRE*CELULAR" 10x de 480,00 (parcelas 1–3 vistas);
  - transferência Nubank → PicPay casada;
  - salário no dia 5;
  - Netflix, Spotify e Smart Fit;
  - tarifa PACOTE SERVICOS;
  - boleto com multa;
  - "PARC EMPREST 07/24" de 610,00 nos últimos 3 meses (vira a sugestão do extrato);
  - cheque especial 350,00.
- **Registrato de exemplo** (`REGISTRATO_DE_EXEMPLO`), usado em "Usar exemplo". O consignado do Itaú dele **é o mesmo** da parcela do extrato, então enviar o Registrato funde com a sugestão do extrato. Isso mostra a fusão na apresentação.
- **Botão Simular compra do banco:** só em DEMO.

- [ ] **Step 1: Teste que falha:** `criarEspacoDemo` gera para a Ana:
  - 1 conexão, 3 movimentos `revisar`, 1 parcelada e as sugestões (consignado do extrato e cheque especial);
  - processar `REGISTRATO_DE_EXEMPLO` depois deixa **um** consignado (fundido, `fonte "registrato"`) e soma Nubank e Caixa;
  - materializar de novo não duplica.
- [ ] **Step 2:** FALHA → implementar → PASSA.
- [ ] **Step 3:** Botão **Simular compra** (lista e sino atualizam via `aoMudar`).
- [ ] **Step 4:** README:
  - seção "Bancos conectados e documentos": variáveis, banco de teste (`user-ok` / `password-ok`), MeuPluggy, limites (empréstimos reais só em produção paga);
  - documentos aceitos (fatura, extrato, print, Registrato, contrato).
- [ ] **Step 5: Gate completo:**
  - `pnpm test` (0 falhas), `pnpm typecheck`, `pnpm lint`;
  - navegador: Ana → Hoje "3 compras para revisar" → Simular compra → sino + Luana → registrar → Dívidas → Enviar Registrato (exemplo) → consignado fundido → Contas → Próximos meses.
- [ ] **Step 6:** Commit `feat(banco): demonstração da Ana com banco e Registrato` e `git push`.
- [ ] **Step 7: Revisão da branch inteira** por um revisor novo (`/code-review` no diff desde `a0b92c7`), corrigindo os achados antes de declarar pronto.
