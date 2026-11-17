# Bancos conectados — Entrega 2 (extras) · Plano

> Execução direta nesta sessão (aprovada pelo Gabriel ao pedir "continue fazendo as outras coisas"), com TDD por tarefa e revisão ao final.

**Spec:** `docs/superpowers/specs/2026-11-17-pluggy-open-finance-design.md`, seção 5.6.

**Goal:** os extras da seção 5.6, com os dados que a entrega 1 já grava (contas, movimentos, sugestões) e investimentos novos.

## Global Constraints
- Mesmas regras da entrega 1: centavos, datas de Brasília, migrações só aditivas, `exigirAPropriaPessoa` para escrita, profissional só lê com `compartilharContas`.
- Avisos nunca se repetem: a chave do aviso vai em `Aviso.referencia` (`limite:<conta>:<mes>`, `consentimento:<conexao>`, `seguro:<chave da dívida>`).
- Nada aqui registra compra ou dívida sozinho: tudo é sugestão ou aviso.

## Tarefas

### E1 · Regras dos extras (`src/lib/banco/extras.ts`)
Funções puras, cada uma com teste:
- `melhorDiaDeCompra(conta)`: o dia seguinte ao fechamento, ou null.
- `usoDoLimite(conta)`: `{ usado, limite, fracao }`, ou null sem limite.
- `rendaDetectada(movs, hoje)`: entradas `renda`, ou recorrentes da mesma origem, em 2 ou mais meses distintos com valor a ±10%; devolve `{ valor, dia }`.
- `assinaturasDetectadas(movs)`: saídas `compra` da mesma loja em 2 ou mais meses seguidos, valor a ±10%, no máximo 1 por mês. Devolve `[{ nome, valor, meses, ultimaData }]`.
- `tarifasDoMes(movs, mes)` e `jurosDeBoletoDoMes(movs, mes)`.

### E2 · Investimentos e metas
- Modelo `InvestimentoBancario` (`pluggyId` único, `conexaoId`, `nome`, `tipo`, `saldo`) e sincronização dos investimentos (parte opcional, não derruba a sincronização).
- `Meta.investimentos` com os ids ligados. Quando houver ids, `situacaoDaMeta` usa o saldo somado desses investimentos como "guardado".
- Ação `metas.ligarInvestimentos(p, metaId, ids[])`.

### E3 · Avisos e sugestões na sincronização
- Limite ≥ 80% gera aviso `limite-cartao`, uma vez por cartão e mês.
- Autorização (`consentimentoAte`) a 15 dias ou menos gera aviso `consentimento`, uma vez por conexão e data.
- Dívida nova com `temSeguro` gera aviso `seguro`, uma vez.
- Renda detectada diferente da cadastrada (ou sem renda cadastrada) gera `Sugestao` tipo `renda`, chave `renda`.

### E4 · Telas
- **Bancos conectados:** em cada cartão, a barra do limite usado, "melhor dia de compra: dia X" e o selo "autorização vence em N dias" com o botão **Renovar** (reconectar).
- **Contas:**
  - cartão "Sua renda parece ser R$ X no dia D" (**Usar** / **Agora não**);
  - painel "Assinaturas" com o total por mês e **Virar conta fixa**;
  - painel "Tarifas do banco" com a dica da conta gratuita.
- **Dívidas:** linha "Juros e multa de boletos pagos atrasados" no raio-x, quando houver.
- **Meta:** "Ligar a um investimento" (escolher na lista); o valor guardado passa a mostrar "atualizado pelo banco".

### E5 · Demonstração e fechamento
- Ana:
  - cartão com limite de R$ 3.000, 85% usado, fechamento dia 3;
  - autorização vencendo em 10 dias;
  - investimento "CDB Reserva" ligado à meta "Reserva de emergência";
  - os demais extras já existem na semente.
- README, verificação no navegador e revisão final.
