# Bancos conectados (Pluggy / Open Finance) — design

Data: 17/11/2026 · Branch: `feat/pausa-frontend` · Estado: aguardando aprovação

## 1. Intenção

Hoje a pessoa registra cada compra à mão (app ou WhatsApp), cadastra as dívidas digitando saldo e taxa, e só descobre juros e IOF subindo o PDF da fatura. Conectar os bancos pela Pluggy tira esse trabalho e, principalmente, dá a **organização dos próximos meses**: quanto já está comprometido com faturas, parcelas e empréstimos, e quando cada coisa acaba.

O ponto mais importante para o Gabriel é a **parte de dívidas** (empréstimos, financiamentos, cheque especial, cartão). Em seguida vem a de compras, com uma regra firme: **o banco não registra compra sozinho, a menos que a pessoa escolha isso**. Registrar à mão continua igual.

## 2. Objetivos, não-objetivos e anti-objetivos

**Objetivos**
- Conectar um ou mais bancos pela janela da Pluggy (o app nunca vê senha).
- Puxar contas, cartões, transações (12 meses), empréstimos, faturas, investimentos e identidade (CPF).
- Compras do banco em 3 modos, escolhidos pela pessoa: **Revisar antes** (padrão), **Registrar sozinho** e **Não usar compras**.
- Só as compras dos **últimos 7 dias** antes da conexão viram aviso; o histórico alimenta totais, parcelas, taxas e padrões sem pedir nada.
- Registrar compra do banco reaproveita a janela de registro, já preenchida e com a categoria automática editável.
- **Compra parcelada é uma coisa só**: renomear, mudar categoria e emoção vale para todas as parcelas, inclusive as futuras.
- **Transferência entre contas da própria pessoa** e **pagamento de fatura** não contam como gasto nem como ganho.
- Empréstimos, financiamentos e cheque especial viram **sugestões de dívida** já preenchidas. Depois de aceitas, se atualizam sozinhas (selo "do banco").
- Nova visão **Próximos meses** em Contas (12 meses).
- Extras: melhor dia de compra, limite do cartão, salário detectado, assinaturas, tarifas bancárias, juros/multa de boleto atrasado, investimentos ligados a metas, seguro embutido em empréstimo e aviso de autorização vencendo.

**Não-objetivos (agora)**
- Bancos reais em produção: exige liberação comercial da Pluggy. Tudo roda com o ambiente de desenvolvimento (banco de teste + até 100 conexões).
- Pagamentos ou Pix iniciados pelo app.
- Consulta ao Registrato/SCR: só uma dica com link.
- Agendador de mensagens (já é lacuna conhecida do projeto).

**Anti-objetivos (seria fracasso mesmo funcionando)**
- Enxurrada de avisos ao conectar (300 compras pedindo emoção).
- Contar a mesma coisa duas vezes: transferência própria como gasto + ganho; fatura paga + compras do cartão; parcela do cartão fora e dentro da fatura; empréstimo do banco + parcela simulada do plano.
- Números absurdos vindos do banco (o banco de teste tem empréstimo com 130.632 parcelas) aparecendo na tela.
- Mostrar dados do banco para a profissional sem a pessoa ter compartilhado as contas.
- Segredos da Pluggy no git ou no navegador.

## 3. Restrições (verificadas em 17/11/2026)

Fonte: docs.pluggy.ai, pacotes npm e uma conexão real com o banco de teste (`Pluggy Bank`, connector **2**, login `user-ok` / `password-ok`). As respostas foram salvas em `scratchpad/pluggy/` e devem virar fixtures de teste (sem dados pessoais; o sandbox é fictício).

- **API**: `https://api.pluggy.ai`, `POST /auth` → `apiKey` (2 h). Connect token: `POST /connect_token` (30 min), opções `webhookUrl`, `clientUserId`, `avoidDuplicates`; `itemId` na raiz para reconectar.
- **Transações**: usar **`GET /v2/transactions`** (cursor `next`). O `/transactions` antigo morre em **31/12/2026**. Não aceita `pageSize`. Incremental por `createdAtFrom` (não combina com `dateFrom`).
- **Categoria**: no nosso app de desenvolvimento **todas as transações vieram com `category: null`**. A categorização precisa ser nossa; a da Pluggy é só uma dica quando vier.
- **Sinais não confiáveis**: no cartão do sandbox as compras vêm `type: CREDIT` com valor negativo, ao contrário da documentação. A direção é decidida pelo tipo da conta + descrição + metadados, nunca só pelo sinal. Valor = `Math.abs(amount)` em centavos.
- **Parcelas**: `creditCardMetadata` traz `installmentNumber`, `totalInstallments`, `totalAmount`, `purchaseDate`, `billId`, `billForecastDate`, `payeeMCC`. No sandbox, só 1 transação tem isso.
- **Empréstimo** (sandbox, campos úteis): `productName`, `kind`, `contractAmount`, `totalRemainingAmount`, `nextInstallmentAmount`, `dueDate` (fim), `firstInstallmentDueDate`, `installmentPeriodicity`, `CET` (ao ano), `interestRates[] {preFixedRate, taxPeriodicity, taxType}`, `installments {totalNumberOfInstallments, paidInstallments, dueInstallments, pastDueInstallments}`, `payments.contractOutstandingBalance`, `hasInsuranceContracted`, `contractedFees`. Vários números são incoerentes, daí as travas da seção 6.4.
- **Faturas** (`/bills?accountId`): `dueDate`, `billClosingDate`, `totalAmount`, `minimumPaymentAmount`, `financeCharges[] {type, amount}`. Não somar `OTHER`. Só vem garantido em conexões Open Finance.
- **Cartão** (`account.creditData`): `creditLimit`, `availableCreditLimit`, `minimumPayment`, `balanceCloseDate`, `balanceDueDate`.
- **Conta** (`bankData`): `overdraftContractedLimit`, `overdraftUsedLimit`, `automaticallyInvestedBalance`.
- **Identidade** (`/identity?itemId`): `document` (CPF), `fullName`.
- **Transação Pix/TED/boleto**: `paymentData.payer/receiver.documentNumber` (CPF/CNPJ) e `boletoMetadata {interestAmount, penaltyAmount}`.
- **Bancos disponíveis no nosso app de desenvolvimento** (consultado em `/connectors`): só os bancos de teste e o **MeuPluggy** (connector 200). Para usar banco de verdade, a pessoa cria uma conta grátis no Meu Pluggy, conecta os bancos dela lá e, no Desafoga, escolhe "MeuPluggy". Produtos do MeuPluggy: contas, transações, cartões, investimentos, dados de pagamento e identidade. **Não inclui empréstimos (LOANS)**. Empréstimos reais só com acesso de produção (liberação comercial da Pluggy). No hackathon, os empréstimos vêm do banco de teste e da demo.
- **Atualização**: automática só em produção. `PATCH /items/{id}` no máximo **1 vez por hora**. O banco de teste só muda uma vez por semana. Conexões que pedem MFA precisam reabrir a janela com `updateItem`.
- **Webhook**: sem assinatura. Proteger com segredo na query (`?s=`), conferir `clientId` e responder **2xx em até 10 s**, processando depois. URL precisa ser https pública (não funciona em localhost).
- **Janela**: `react-pluggy-connect@2.12.0` carregado só no cliente (`dynamic(..., { ssr: false })`). Lê as props só ao montar (remontar com `key` para trocar o token). `includeSandbox` mostra o banco de teste.
- **Projeto**: Next 16 (ler `node_modules/next/dist/docs/` antes de usar `after()` e route handlers), Prisma 7 com migrações só aditivas, valores em centavos, data de Brasília via `hojeEmBrasilia()`, camada de serviços (`src/services`) chamando `/api/desafoga/[acao]` com validação zod e checagem de acesso (`exigirAPropriaPessoa`, `exigirProfissionalDe`). Espaços **DEMO** (cópia da Ana por visita) e **REAL**.
- **Segredos**: `PLUGGY_CLIENT_ID` e `PLUGGY_CLIENT_SECRET` já estão no `.env.local` (fora do git). Novos: `PLUGGY_WEBHOOK_SEGREDO`, `PLUGGY_WEBHOOK_URL` (só quando houver URL pública) e `PLUGGY_SANDBOX=1` (mostra o banco de teste na janela).

## 4. Abordagens consideradas

| | Como atualiza | Prós | Contras |
|---|---|---|---|
| **A. Sincronização única, chamada por 3 gatilhos** (escolhida) | Uma função `sincronizar(conexao)` idempotente, chamada pelo webhook, ao abrir o app (se passou 1 h) e pelo botão "Atualizar" | Funciona no computador sem webhook; em produção recebe na hora; um caminho só para testar | Precisa de trava contra duas sincronizações ao mesmo tempo |
| B. Só webhook | Pluggy avisa, servidor busca | Simples | Não funciona localmente (o túnel falhou com a Twilio); demo dependeria de internet pública |
| C. Só puxar sob demanda | Botão e abertura do app | Simples | Em produção a compra só aparece quando a pessoa abre o app; sem a "Luana avisando na hora" |

Também considerado: chamar a API por `fetch` próprio em vez do `pluggy-sdk`. **Escolha: `pluggy-sdk@0.94.3`** (cuida do token e da paginação), atrás de uma interface nossa (`ClientePluggy`) para os testes usarem fixtures.

## 5. Experiência

### 5.1 Conectar
Em **Contas** (e atalho no Perfil) entra o bloco **Bancos conectados**:
```
Bancos conectados
🏦 Nubank        atualizado há 2 h     [Atualizar] [⋯]
🏦 Itaú          ⚠ precisa reconectar   [Reconectar]
+ Conectar banco
Compras do banco: (•) Revisar antes  ( ) Registrar sozinho  ( ) Não usar compras
```
O menu `⋯` tem "Desconectar". A janela da Pluggy abre por cima. Ao terminar, aparece "Lendo seu banco…" e depois um resumo: "Achei 2 contas, 1 cartão, 1 empréstimo e 3 compras desta semana".

### 5.2 Compras para revisar (modo padrão)
- Aparecem no **sino** (novo tipo de aviso `compra-banco`), num cartão em **Hoje** ("3 compras para revisar") e numa mensagem da Luana no chat do app ("Vi R$ 45,90 no iFood agora. Como você estava?").
- **Registrar** abre a janela de registro de sempre (`FluxoDeRegistro`) **pré-preenchida**: item e valor do banco (valor só leitura), categoria automática já marcada (pode trocar). Começa na escolha da categoria/nome para a pessoa poder ajustar, depois emoção e necessidade.
- Ações extras no aviso: **Ignorar** e **É transferência minha**.
- **Registrar sozinho**: cria a compra direto com a categoria automática e **emoção vazia**. Fica marcada "sem emoção"; a pessoa completa quando quiser. Essas compras não entram nas estatísticas de emoção.
- **Não usar compras**: transações só servem para totais do banco, parcelas, taxas e padrões.
- **Juntar com o que já foi registrado à mão**: se existe compra manual ainda sem vínculo com o mesmo valor (±R$ 0,50) e data a até 1 dia (3 dias para cartão), o movimento do banco se liga a ela e não gera aviso.

### 5.3 Compra parcelada
```
iPhone pessoal                                    [Renomear]
Mercado Livre · comprado em 10/05 · R$ 4.800 em 10x de R$ 480
Pagas 3 · faltam 7 · última na fatura de mai/27
jun ✓  jul ✓  ago ✓  set ○  out ○ …
```
As parcelas se juntam numa **CompraParcelada**. Nome, categoria, emoção e necessidade ficam nela e valem para todas. Ela pede emoção **uma vez** (na primeira parcela que aparecer dentro da janela de 7 dias, ou quando a pessoa abrir).

### 5.4 Dívidas
- Ao sincronizar, empréstimos, financiamentos e cheque especial em uso viram **sugestão** no topo de Dívidas: "Achei 2 contratos no Itaú. [Adicionar] [Agora não]".
- A dívida aceita ganha o selo **do banco**. Saldo, parcela, taxa e parcelas restantes se atualizam a cada sincronização. Não dá para editar à mão; o botão **Desvincular** a transforma em dívida manual.
- Detalhe da dívida do banco: banco, produto, valor contratado, saldo, parcela, taxa ao mês, CET ao ano, parcelas pagas/restantes/atrasadas, termina em, tarifas contratadas e o aviso **"tem seguro contratado"** quando `hasInsuranceContracted`.
- Dica fixa: "Não lembra de todas? O **Registrato** do Banco Central mostra todos os seus empréstimos (entra com gov.br). Conecte esses bancos aqui ou adicione à mão."
- **Cartão**: não vira dívida automática. A fatura aparece em Contas. Se a fatura vencida não foi paga inteira, sugere a dívida "Rotativo do cartão" com o valor que ficou.

### 5.5 Próximos meses (Contas)
```
Próximos meses                                   comprometido / renda
Dez  R$ 2.140 ███████████████░░  Fatura Nubank 1.230 (5 parcelas) · Itaú 610 · Fixas 300
Jan  R$ 1.980 ██████████████░░░  Fatura Nubank ~1.070 previsto · …
Fev  R$ 1.650 ███████████░░░░░░  🎉 iPhone termina em jan
```
Por mês: contas fixas + fatura de cada cartão (aberta = valor real; futuras = soma das parcelas conhecidas, marcadas "previsto") + parcela de cada dívida (do banco = parcela real; manual = como hoje pelo plano) + renda e sobra. Marca quando cada parcelamento ou empréstimo acaba. 12 meses.

### 5.6 Extras
| Extra | Regra | Onde aparece |
|---|---|---|
| Melhor dia de compra | dia seguinte ao `balanceCloseDate` | Cartão em Contas; Luana quando a compra é grande |
| Limite do cartão | usado/limite ≥ 80% gera aviso (1 por fatura) | Contas + sino |
| Salário detectado | entrada recorrente (≥ 2 meses, ±10%, mesmo pagador) ou categoria Salário | Sugestão "Sua renda é R$ 2.800 no dia 5?" em Contas |
| Assinaturas | mesma loja, valor ±10%, ≥ 2 meses seguidos | Lista "Você paga R$ 167/mês em assinaturas"; botão para virar conta fixa |
| Tarifas do banco | categoria de tarifa ou descrição com TARIFA/PACOTE/CESTA/ANUIDADE | Encargos e dica "dá para pedir conta gratuita" |
| Juros/multa de boleto | `boletoMetadata.interestAmount + penaltyAmount` | Custo do atraso, junto com juros do cartão |
| Investimentos e metas | a pessoa liga uma meta a um ou mais investimentos/poupança; o guardado da meta passa a seguir o saldo do banco | Meta mostra "atualizado pelo banco" |
| Seguro no empréstimo | `hasInsuranceContracted` | Detalhe da dívida + aviso único |
| Autorização vencendo | `consentExpiresAt` a 15 dias | Sino + bloco do banco "Renovar" |

## 6. Como funciona por dentro

### 6.1 Dados (migração aditiva)
- **ConexaoBancaria**: `id`, `pessoaId`, `pluggyItemId` (único), `banco` (nome do conector), `logo`, `status` (normalizado: ok / atualizando / reconectar / erro), `ultimaSincronizacao`, `ultimoPedidoDeAtualizacao`, `consentimentoAte`, `conectadaEm`, `cpfDoTitular`.
- **ContaBancaria**: `pluggyAccountId` (único), `conexaoId`, `tipo` (corrente / poupanca / cartao), `nome`, `saldo`, `limite`, `limiteDisponivel`, `fechamento`, `vencimento`, `chequeEspecialUsado`, `chequeEspecialLimite`.
- **Movimento** (transação normalizada): `pluggyId` (único), `contaId`, `data` (YYYY-MM-DD de Brasília), `descricao`, `descricaoOriginal`, `valor` (centavos, positivo), `direcao` (saida / entrada), `natureza` (compra / transferencia-propria / pagamento-fatura / renda / tarifa / juros / iof / estorno / outra-entrada / outra-saida), `categoria` (nossa) e `categoriaPluggy`, `situacao` (revisar / registrada / ignorada / historico / automatica), `compraId?`, `parceladaId?`, `parcela?`, `totalParcelas?`, `faturaPrevista?` (YYYY-MM), `cnpj?`, `mcc?`, `documentoContraparte?`, `jurosBoleto?`.
- **CompraParcelada**: `id`, `pessoaId`, `nome`, `lojaOriginal`, `categoria`, `valorTotal`, `valorParcela`, `totalParcelas`, `compradaEm`, `contaId`, `compraId?`.
- **SugestaoDoBanco**: `tipo` (divida / renda / rotativo / conta-fixa), `chave` (único por pessoa, ex.: id do contrato), `dados` (JSON), `situacao` (aberta / aceita / dispensada).
- **RegraDoBanco** (aprendizado): `pessoaId`, `padrao` (descrição normalizada ou documento da contraparte), `efeito` (categoria X / transferência própria / ignorar).
- **Divida**: novos campos opcionais `origem` (manual / banco), `pluggyLoanId`, `instituicao`, `cet`, `parcelasRestantes`, `temSeguro`, `atualizadaEm`.
- **Compra**: `emocao` e `necessidade` passam a aceitar **nulo** (modo "registrar sozinho"); `via` ganha `"banco"`; campos opcionais `parceladaId`, `parcelas`, `valorDaParcela` (ver 6.5). Toda conta que usa emoção ignora as compras sem emoção. O tipo TS fica `Emocao | null`.
- **Pessoa**: `modoComprasDoBanco` (revisar / automatico / desligado, padrão revisar).
- **Meta**: lista opcional de `pluggyInvestmentId` ligados.
- **Fatura**: faturas que vêm do banco são gravadas no modelo existente com `origem` = nome do cartão e um `pluggyBillId` opcional (único), para a tela de Fatura e o custo emocional funcionarem sem PDF.

### 6.2 Sincronização (`src/lib/banco/sincronizar.ts`)
1. Trava por conexão (linha com `sincronizandoDesde`; ignora se < 5 min).
2. Item → status. Se `LOGIN_ERROR` / `WAITING_USER_ACTION` / `OUTDATED`: marca "reconectar" e para.
3. Contas → upsert. Identidade → CPF.
4. Transações v2: na primeira vez, tudo (12 meses); depois, `createdAtFrom` = última sincronização − 1 dia (folga). Upsert por `pluggyId`. Aplica `transactions/deleted` removendo e `updated` (PENDING → POSTED) atualizando sem duplicar aviso.
5. Classificar (6.3) → agrupar parcelas → casar transferências → juntar com compras manuais.
6. Gerar avisos e compras conforme o modo, **só para movimentos com data ≥ (data da conexão − 7 dias)**. O resto fica `historico`.
7. Empréstimos → mapear (6.4) → atualizar dívidas vinculadas ou criar/atualizar sugestões.
8. Faturas → gravar encargos (`LATE_PAYMENT_*` como juros, `IOF` como iof, multa como tarifa; ignorar `OTHER`).
9. Investimentos → atualizar metas ligadas.
10. Extras (5.6) → sugestões e avisos, sem repetir (chave por mês/fatura).

**Gatilhos**
- **Webhook** `POST /api/pluggy/webhook?s=SEGREDO`: confere segredo e `clientId`, responde 200 e roda a sincronização com `after()`. Eventos: `item/updated`, `item/error`, `item/waiting_user_action`, `transactions/*`, `item/deleted`.
- **Ao abrir o app**: se a última sincronização tem mais de 1 h, pede `PATCH /items` (respeitando 1 por hora) e lê o que já existe.
- **Botão Atualizar**: igual, mostrando "próxima atualização possível às 15:40" quando bloqueado.

### 6.3 Classificação de cada movimento
Em ordem, a primeira que decidir vence:
1. Regras aprendidas da pessoa.
2. **Transferência própria**: CPF da contraparte = CPF do titular; ou par saída/entrada de mesmo valor em contas conectadas da pessoa em até 2 dias; ou categoria Pluggy de mesma titularidade; ou descrição com o nome da pessoa e "TRANSF"/"PIX".
3. **Pagamento de fatura**: na conta corrente, descrição com PAGAMENTO/PGTO + FATURA/CARTAO, ou boleto cujo recebedor é o emissor do cartão. No cartão, a entrada correspondente ao pagamento.
4. **Estorno** (ESTORNO/REEMBOLSO/CHARGEBACK) abate da compra de origem quando achar.
5. **Encargos**: IOF, JUROS, MULTA, TARIFA, ANUIDADE, ENCARGOS.
6. **Renda**: entrada com categoria Salário/"SALARIO"/"PROVENTOS" ou recorrente (5.6).
7. Saída no cartão ou débito/Pix para empresa = **compra**. Categoria por: dicionário de lojas (iFood → Comida pronta, Drogasil/Pague Menos → Farmácia, Carrefour/Assaí/Pão de Açúcar → Mercado, Renner/C&A/Shein → Roupa, Netflix/Spotify/Smart Fit → Lazer…) → MCC → categoria Pluggy mapeada → "Outro". Contas de consumo (luz, água, condomínio, internet) viram natureza `outra-saida` com sugestão de conta fixa, não compra emocional.
8. Corrigir a categoria ou marcar transferência cria uma `RegraDoBanco`.

### 6.4 Mapeamento de empréstimo → dívida (com travas)
- `saldo` (o que entra no plano de quitação) é o **saldo devedor sem juros futuros**:
  1. `payments.contractOutstandingBalance`, se for coerente (≤ `totalRemainingAmount` e > parcela);
  2. senão, o valor presente das parcelas restantes na taxa do contrato: `parcela × (1 − (1+i)^−n) / i`;
  3. senão, `totalRemainingAmount` marcado "confira".
- `totalRemainingAmount` é mostrado como "Falta pagar (com juros)".
- `parcela` = `nextInstallmentAmount` → senão `saldo / parcelas restantes`.
- `taxaMensal`: primeira `interestRates` com `preFixedRate`. Se `YEARLY`: `(1 + r)^(1/12) − 1`; se `MONTHLY`: `r`. Se não houver: derivar de `CET` anual. Se nada: deixar a pessoa preencher na sugestão.
- Parcelas restantes: de `installments` só se for um número entre 1 e 480 e coerente com `dueDate`; senão `ceil(saldo / parcela)`; senão meses até `dueDate`.
- `vencimento` = dia de `firstInstallmentDueDate`.
- **Trava geral**: valor negativo, taxa > 30% a.m., parcela > saldo × 2 ou mais de 480 parcelas → campo marcado "confira" e não usado em cálculo até a pessoa confirmar.
- **Confirmar ou corrigir** um campo "confira" acontece na própria dívida, sem desvincular (é a única edição permitida numa dívida do banco). A correção fica salva como valor da pessoa para aquele campo e a sincronização não a sobrescreve. A correção some quando o banco passar a mandar um valor coerente (diferente do que estava travado) ou quando a pessoa desfaz.
- **Dívidas do banco entram no plano de quitação** como as manuais (estratégia e valor extra valem para elas). A parcela mínima é a parcela real do contrato.
- Tipo: `kind` LOAN → empréstimo (consignado se o produto disser), FINANCING → financiamento, UNARRANGED_ACCOUNT_OVERDRAFT ou `overdraftUsedLimit > 0` → cheque especial (taxa: se o banco não informar, a pessoa preenche; mostrar a média de mercado como referência rotulada).

### 6.5 Sem contar duas vezes
- **Compra parcelada vira uma Compra só**: valor = total, `quando` = data da compra, com os campos novos `parceladaId`, `parcelas` e `valorDaParcela`. Emoção e necessidade são da compra inteira; as estatísticas de emoção usam o total, porque a decisão foi uma só.
- **Orçamento do mês e totais de Hoje** usam a função nova `gastosDoMes`, que junta:
  - as Compras da pessoa (a parcelada entra com **a parcela daquele mês**);
  - os movimentos do banco de natureza `compra` ainda sem compra ligada, nas situações `revisar` e `historico`.
- Movimentos ignorados não entram. No modo "Não usar compras", movimentos do banco nunca entram.
- O dinheiro já saiu, então o orçamento conta mesmo sem revisão. **Padrões e estatísticas de emoção** usam só Compras com emoção.
- A profissional vê os mesmos totais, se `Rotina.compartilharContas`.
- **Juntar com compra manual**:
  - valor igual (±R$ 0,50) e data a até 1 dia (3 no cartão);
  - **ou**, para parcelada, compra manual com valor ≈ total da compra (±1%) ou ≈ valor da parcela, a até 3 dias da data da compra.
- Transferência própria, pagamento de fatura e estorno não contam.
- **Fatura do cartão conectado**:
  - Para cada mês de fatura, as transações do cartão são gravadas como `Lancamento` numa `Fatura` com `origem` = cartão e `pluggyBillId`. Com isso a tela de Fatura e o custo emocional funcionam.
  - Juros e IOF vêm das transações classificadas como encargo. Os `financeCharges` da fatura só entram se não houver transação equivalente, porque a Pluggy avisa que eles costumam se repetir nas transações.
  - Ao subir um PDF com cartão conectado, o app pergunta: "Esta fatura é de um cartão conectado?". Se sim, o PDF é guardado mas fica fora dos cálculos daquele mês.
- **Troca de modo** vale dali para frente:
  - para "Registrar sozinho": as compras ainda em revisão viram compras automáticas;
  - para "Não usar compras": os avisos pendentes somem e as compras vão para o histórico;
  - de volta para "Revisar antes": só as compras novas geram aviso, para não haver enxurrada.
- **Próximos meses**: parcelas do cartão só **dentro** da fatura do cartão. Dívida do banco usa a parcela real e sai da simulação do plano. A fatura do cartão que já está como conta fixa manual é ignorada se houver cartão conectado com o mesmo nome (perguntar uma vez).

### 6.6 Janela da Pluggy e rotas
- Ações novas em `rotas.ts`: `banco.listar`, `banco.tokenDeConexao` (cria connect token com `clientUserId` = id da pessoa e `webhookUrl` quando houver URL pública), `banco.conectado` (recebe o `item.id` do `onSuccess`, cria a conexão e sincroniza), `banco.atualizar`, `banco.desconectar`, `banco.modo`, `banco.movimentos`, `banco.ignorar`, `banco.marcarTransferencia`, `banco.registrar` (cria a compra a partir do movimento ou da parcelada), `banco.renomearParcelada`, `banco.sugestoes` / `banco.aceitarSugestao` / `banco.dispensarSugestao`, `dividas.desvincular`, `metas.ligarInvestimentos`, `banco.simularCompra` (só espaço DEMO).
- Acesso: tudo `exigirAPropriaPessoa`. A profissional só lê (`banco.listar`, próximos meses e movimentos) quando `Rotina.compartilharContas` (padrão: sim).
- Serviço `BancoService` em `src/services`, seguindo o padrão de `ContasService`.
- **Desconectar**: apaga o item na Pluggy, remove conexão, contas e movimentos não registrados. Mantém as compras já registradas. Dívidas do banco viram manuais.

### 6.7 Demonstração
- A Ana ganha uma conexão fictícia **"Banco Demonstração"** (sem Pluggy) semeada com dados realistas e coerentes:
  - 3 compras para revisar;
  - "MERCADOLIVRE*CELULAR" em 10x (3 pagas);
  - transferência Nubank → PicPay casada;
  - salário no dia 5;
  - Netflix, Spotify e Smart Fit;
  - tarifa de pacote;
  - boleto pago com multa;
  - consignado com seguro;
  - cheque especial em uso;
  - investimento ligado à meta.
- Botão **"Simular compra do banco"** (só em DEMO) cria um movimento novo e dispara o aviso e a mensagem da Luana na hora.
- Em DEMO também dá para conectar o banco de teste real da Pluggy (`includeSandbox`).
- **Limite de 100 conexões**: a limpeza de espaços DEMO vencidos (`sessao.ts`, `VIDA_DA_DEMO_MS`) e o "sair da demo" passam a apagar antes, na Pluggy, os itens daquelas conexões. Uma falha aqui não impede a limpeza. Além disso, cada espaço DEMO pode ter no máximo 1 conexão real com a Pluggy.
- Na janela aparecem: o banco de teste (quando `PLUGGY_SANDBOX=1` ou espaço DEMO) e o MeuPluggy (sempre).

## 7. Entregas
1. **Base + dívidas + compras**: conexão, sincronização, classificação, transferências, compras (3 modos, aviso, registro pré-preenchido), parceladas com renomear, dívidas do banco, próximos meses, demo.
2. **Extras** da seção 5.6 e webhook em produção (Vercel + variáveis).

## 8. Fica a cargo de quem construir
- Nomes de arquivos, componentes e funções, seguindo o estilo do projeto (português).
- O dicionário inicial de lojas e MCCs (cobrir as ~60 marcas mais comuns no Brasil).
- Usar ou não o Gemini como último recurso de categoria (em lote, com o resultado salvo como regra).
- Como mostrar progresso da primeira sincronização.
- Testes: unitários para classificação, transferências, parcelas, travas do empréstimo e próximos meses; integração da sincronização com cliente Pluggy falso alimentado pelas respostas do sandbox.

## 9. Documentos como fonte gratuita (acréscimo de 17/11/2026)

A Pluggy em produção é paga (plano Dados, a partir de R$ 2.500/mês) e o MeuPluggy não traz empréstimos. Os **documentos que a pessoa sobe** são o caminho de graça para o mesmo resultado. Eles alimentam **as mesmas estruturas** (`CompraParcelada`, sugestões de dívida, `proximosMeses`); não há caminho paralelo.

- **Fatura em PDF**:
  - a `parcela` impressa ("03/06") monta a `CompraParcelada` (mesma chave e mesma junção com compra manual);
  - vencimento, total, pagamento mínimo e juros do rotativo ficam guardados na `Fatura` e vão para Próximos meses e para a sugestão de rotativo;
  - se a mesma fatura também vier da Pluggy, **a Pluggy vence** e o PDF só completa o que faltar.
- **Extrato**: nova natureza `parcela_emprestimo` (PARC EMPREST, CONSIGNADO, FINANC). A mesma descrição em 2 ou mais meses, ou 1 com "PARC x/y", vira sugestão de dívida. Nunca é compra nem entra no orçamento.
- **Registrato** (SCR do Banco Central):
  - novo tipo de documento; cada instituição × modalidade vira sugestão;
  - sem taxa e sem número de parcelas, que ficam como "confira" para a pessoa completar;
  - valores vencidos em destaque;
  - a dica da tela de Dívidas ganha o botão **Enviar Registrato**.
- **Contrato ou print do empréstimo**: novo tipo de documento. Lê saldo, parcela, parcelas pagas/restantes, taxa, CET e seguro, e passa pelas mesmas travas.
- **Regras comuns**:
  - a IA só transcreve; o código converte (`lerValorEmReais`, `lerPercentual`);
  - **uma dívida só por contrato**: chave por instituição normalizada + tipo (+ parcela);
  - confiança: Pluggy > contrato > Registrato > fatura/extrato. A fonte mais confiável atualiza a menos confiável, nunca o contrário, e correções da pessoa nunca são sobrescritas;
  - `Divida.origem` passa a ser manual / banco / documento, e o selo mostra a fonte ("do banco", "do Registrato", "do contrato", "do extrato").
