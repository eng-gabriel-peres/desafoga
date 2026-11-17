# SDD ledger — plan: docs/superpowers/plans/2026-11-17-pluggy-entrega-1.md
Spec: docs/superpowers/specs/2026-11-17-pluggy-open-finance-design.md (secs 3,5,6,9)
Setup: Ruling: executar na branch feat/pausa-frontend (não main) sem worktree — o usuário commita/pusha nessa branch; custo se errado: nenhum além do histórico na mesma branch.
Pre-flight: T4←T2 CandidataParcelada/MovimentoNovo ok; T5←T1/T2 PluggyEmprestimo/SugestaoDeDivida ok; T6←T2,T4,T5 (CandidataParcelada, aplicarTravas, PARCELA_DE_EMPRESTIMO de T3) ok; T8←T2,T7 ok; T9←T4,T5 (encontrarParcelada, encontrarDivida, fundirDivida) ok; T10/T11←T9 receberSugestaoDeDivida/salvarParcelada ok; T12←T10,T11 ok. Sem conflitos.
Task 1: complete (commits a43a719..c210965, tests: pnpm test →    Duration  14.10s (tests 56%, transform 32%, import 11%, worker 2%))
Task 2: Ruling: diaEmBrasilia trata 00:00Z/03:00Z exatos como data só-dia — senão datas da Pluggy recuariam um dia em Brasília — custo se errado: transação feita exatamente à meia-noite UTC fica no dia UTC.
Task 2: complete (commits c210965..99d3710, tests: pnpm test →    Duration  2.17s (tests 47%, import 27%, transform 23%, worker 2%))
Task 3: Ruling: naturezaDe recebe também tipoDaConta no ctx (o plano não listava, mas as regras de cartão vs conta dependem dele) — custo se errado: nenhum, só assinatura.
Task 3: complete (commits 99d3710..1601739, tests: pnpm test →    Duration  3.62s (transform 57%, import 23%, tests 20%))
Task 4: complete (commits 1601739..9e98b52, tests: pnpm test →    Duration  2.22s (tests 46%, import 28%, transform 23%, worker 2%))
Task 5: Ruling: parcelasRestantes da Pluggy = dueInstallments só se coerente com totalRemaining (±10%), senão ceil(totalRemaining/parcela), senão meses até dueDate; sugestaoDoEmprestimo ganha parâmetro hoje — custo se errado: contagem estimada em contratos com balão.
Task 5: complete (commits 9e98b52..6712e54, tests: pnpm test →    Duration  3.42s (tests 45%, import 31%, transform 22%, worker 2%))
Task 6: Ruling: campos novos de Fatura (vencimento, total, pagamentoMinimo, taxaRotativoMensal, contaId, fonte, foraDosCalculos) são opcionais no TS — evita mexer em todas as sementes/fixtures; ausente = documento e dentro dos cálculos — custo se errado: nenhum funcional.
Task 6: Ruling: parcelasDeEmprestimoNosExtratos(extratos) sem o parâmetro emissores — a instituição é a origem da própria Fatura — custo se errado: nenhum.
Task 6: Ruling: rota faturas.salvar já aceita tipo "parcela_emprestimo" (senão o PDF lido não salvaria) — adiantado da T11.
Task 6: complete (commits 6712e54..652f8f1, tests: pnpm test →    Duration  4.42s (tests 45%, import 27%, transform 25%, worker 2%))
Task 7: Ruling: Compra.parcelas/valorDaParcela/parceladaId opcionais (?) e não obrigatórios — evita tocar dezenas de literais; ausente = à vista — custo se errado: nenhum. Sementes passam emocao 'as number' até a coluna ficar nula na T9.
Task 7: complete (commits 652f8f1..a2be7e0, tests: pnpm test →    Duration  3.78s (tests 48%, import 26%, transform 24%, worker 2%))
Task 8: Ruling: Divida ganha origem?/parcelasRestantes? já na T8 (o plano punha na T9) porque proximosMeses precisa deles — custo: nenhum. Parceladas de origem sem cartão conhecido aparecem como 'Compras parceladas'.
Task 8: complete (commits a2be7e0..253edd7, tests: pnpm test →    Duration  3.95s (tests 50%, import 31%, transform 17%, worker 2%))
Task 9: Ruling: funções do banco em repositorio-banco.ts, reexportado por repositorio.ts (o plano dizia "Modify repositorio.ts"; ele já tem 650 linhas) — custo: nenhum, repo.* continua igual.
Task 9: Ruling: Aviso ganha `referencia` (id do movimento) para o aviso sumir quando o movimento é resolvido/apagado; Divida ganha conexaoId e faltaPagarComJuros; CompraParcelada ganha `avisada` (pede emoção uma vez). Campos novos de Divida no TS são opcionais.
Task 9: Ruling: migração gerada com `prisma migrate diff --from-config-datasource` (o migrate dev --create-only exige terminal interativo); SQL conferido: só CREATE/ADD e DROP NOT NULL em compras.emocao/necessidade.
Task 9: Ruling: teste "depois de aceita" corrigido — a 3ª leitura da Pluggy repetia o saldo antigo; o código estava certo (fonte igual atualiza).
Task 9: complete (commits 253edd7..d5d4e4c, tests: pnpm test →              at least ~385ms faster with isolate: false — reuses workers across files instead of one per file)
Task 10: Ruling: faturas fechadas da Pluggy só contam se venceram nos últimos 60 dias (o sandbox devolve faturas de 2023) — custo: rotativo antigo não é sugerido. Fatura aberta = movimentos do cartão entre fechamento−1 mês e fechamento; total = saldo do cartão.
Task 10: complete (commits d5d4e4c..e65f921, tests: pnpm test →    Duration  2.33s (tests 67%, import 16%, transform 15%, worker 2%))
Task 11: Ruling: lerDocumentoEnviado recebe `ler` injetável (em vez de vi.mock do módulo da IA) — mais simples e sem mock global; custo: nenhum.
Task 11: Ruling: faturas.salvar passa a usar salvarDocumento (com contaId opcional validado como cartão da pessoa) e documentos.ler já entra na rota de arquivo agora; faturas.ler mantém o formato antigo e, para Registrato/contrato, responde com a mensagem "confirme em Dívidas" (as sugestões já foram gravadas).
Task 11: Ruling: a mesma fatura enviada de novo (mesma origem, mês, total e lançamentos) substitui a anterior em vez de duplicar.
Task 11: complete (commits e65f921..09dafa3, tests: pnpm test →    Duration  2.69s (tests 80%, import 13%, transform 5%, worker 1%))
Task 12: Ruling: lógica das ações em banco-acoes.ts (rotas.ts só valida e confere acesso); webhook dividido em conferirWebhook/processarWebhook (testáveis sem o after() do Next) + route.ts fino.
Task 12: Ruling: banco.conectado confere item.clientUserId === pessoa (sem isso alguém poderia ligar o item de outra pessoa); apagar conta real também apaga os itens na Pluggy.
Task 12: Ruling: a profissional que não vê as contas recebe BANCO_ESCONDIDO (listas vazias, compartilhadas:false).
Task 12: complete (commits 09dafa3..09d580a, tests: pnpm test →    Duration  2.68s (tests 83%, import 11%, transform 5%, worker 1%))
Task 12 (fix): Ruling: revisão de segurança automática — banco.conectado era fail-open (item sem clientUserId passava). Agora exige clientUserId === pessoa; teste RED→GREEN em banco-acoes.integracao.
Task 13: EM ANDAMENTO (pausa do usuário). Feito: bancos-conectados.tsx, conectar.tsx (portal no body), atualizar-ao-abrir.tsx, use-pessoa com banco, Contas mostra o bloco, menu do perfil. Falta: verificar no navegador conectar o Pluggy Bank (user-ok/password-ok), trocar modo, desconectar, celular 390px; depois commit final da T13.
