# Seu dinheiro: saldo, cartões e previsão do mês

Pedido: mostrar quanto a pessoa tem e quanto vai sobrar, com débito saindo na hora e cartão caindo na fatura certa (cada cartão fecha num dia).

Decisões do usuário (18/11):
- Compras à mão perguntam como pagou (um toque; lembra a última). Luana também.
- Sem banco conectado: a pessoa informa o saldo e registra entradas e saídas; o app acompanha. Com a Pluggy, saldo e datas vêm do banco.
- Cartão sem banco: cadastro à mão (nome, dia que fecha, dia que vence, limite opcional).

## Regras

- Meio de pagamento: "conta" (débito/Pix: sai da conta na hora), "dinheiro" (não mexe na conta; o saque é uma saída), "cartao" (+ qual).
- Compra no cartão no dia D, cartão fecha dia F e vence dia V: entra na fatura que fecha no primeiro dia F >= D (D == F fica na que fecha nesse dia… conferir convenção: compra no dia do fechamento já vai para a próxima, como nos bancos brasileiros); vence no primeiro V depois desse fechamento. Parcelada: uma parcela em cada fatura seguinte.
- Saldo (sem banco) = saldo informado na data D + renda nos dias de renda depois de D + entradas avulsas − compras na conta − contas pagas − parcelas de dívida pagas − faturas pagas − saídas avulsas.
- Com banco: saldo = soma das contas correntes da Pluggy; faturas dos cartões conectados vêm da Pluggy (sem recalcular pelas compras, para não contar duas vezes).
- Previsão: até o fim do mês = saldo + renda que ainda entra no mês − contas a pagar − parcelas a pagar − faturas que vencem até o fim do mês. Mês que vem = isso + renda − contas − parcelas − faturas que vencem no mês que vem.

## Etapas

E1 regras puras (TDD) · E2 dados e rotas · E3 "como pagou?" no registro e na Luana · E4 Contas: meus cartões, faturas, minha conta · E5 Hoje: Seu dinheiro.
