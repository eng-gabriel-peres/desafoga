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
Task 13: Ruling: conectar o Pluggy Bank no navegador NÃO verificado — a rede atual não alcança api.pluggy.ai nem connect.pluggy.ai (timeout; Google/Gemini respondem). Verificado: janela abre por cima (portal no body; antes ficava presa no painel), erro claro em 15 s quando a Pluggy não responde (teste RED→GREEN), simular compra → aviso no sino, troca de modo tira o aviso, celular 390px sem rolagem lateral. Custo se errado: algum detalhe da janela real da Pluggy só aparece com a rede liberada.
Task 13: Ruling: avisos compra-banco/divida-encontrada vão para o sino da pessoa e ficam fora do painel da profissional (são para a pessoa agir) — teste RED→GREEN.
Task 13: complete (commits 09d580a..e3bbf81, tests: pnpm test →    Duration  9.31s (tests 86%, import 11%, transform 3%, worker 1%))
Task 14: Ruling: PreviaDoRegistro ganhou `tipo` ("banco" | "completar") — o "completar emoção" das compras automáticas reaproveita a mesma janela começando no passo 2. Chamadas antigas onClick={abrirRegistro} viraram () => abrirRegistro() (senão o evento de clique virava prévia).
Task 14: Ruling: compras do banco não mostram hora (o banco só informa o dia); nota do dia conta só compras com emoção; avisos compra-banco/divida-encontrada têm link para Hoje/Dívidas; texto da Luana aponta "Compras para revisar" em vez de "toque para registrar" (no chat não há botão).
Task 14: Verificado no navegador: revisar → registrar trocando categoria (Mercado→Casa), ignorar, modo automático + completar emoção, orçamento contando compra não revisada, celular 390px. NÃO verificado visualmente: tela da fatura em PDF com parcelas/números e a pergunta do cartão (precisa de PDF real + cartão conectado; coberto por tipos e pelos testes do servidor) e a lista de parceladas (fica para a demo da T16).
Task 14: complete (commits e3bbf81..a168c02, tests: pnpm test →    Duration  4.43s (tests 79%, import 11%, transform 9%, worker 1%))
Task 15: Ruling: componentes em banco/proximos-meses.tsx e dividas/enviar-documento.tsx (o plano dizia contas/proximos-meses.tsx, mas "../contas" já é um arquivo e o diretório confundiria a importação).
Task 15: Ruling: nomes de banco legíveis (nomeDaInstituicao: "ITAU UNIBANCO S.A." → "Itaú"); no Registrato, cartão e cheque especial só pedem a taxa (parcela e parcelas restantes só para empréstimo/financiamento) — teste RED→GREEN.
Task 15: Ruling: bug achado no navegador — banco.aceitarSugestao recusava correções parciais (zod 4 z.record com enum exige todas as chaves) → z.partialRecord; teste RED→GREEN.
Task 15: Ruling: Próximos meses não soma a dívida tipo "cartao" no mês em que já há fatura de cartão (a fatura inclui o pagamento) — teste RED→GREEN. Custo se errado: com dois cartões, a dívida de um some no mês em que só o outro tem fatura.
Task 15: Verificado no navegador: Registrato de exemplo → 3 sugestões (vencido em vermelho), adicionar completando taxa/parcela/dia, selo "do Registrato", Conferir (parcelas) e Desvincular visíveis, Próximos meses com 12 meses, "previsto" e "Termina", painel da Paula só leitura sem sugestões.
Task 15: complete (commits a168c02..fa394fc, tests: pnpm test →    Duration  4.27s (tests 81%, import 10%, transform 8%, worker 1%))
Task 16: Ruling: a conexão fictícia da Ana chama "Itaú · demonstração" (não "Banco Demonstração") para o consignado das parcelas do extrato e o do Registrato de exemplo serem o mesmo banco e se juntarem na demo. "Investimento ligado à meta" ficou para a entrega 2 (o plano o listava na demo, mas é extra da entrega 2).
Task 16: Ruling: teste antigo de "conectar" passou a contar só conexões da Pluggy (a demo agora tem a conexão fictícia).
Task 16: Ruling: parcelada mostra "Cobradas N" (inclui a parcela do mês e a maior já vista) em vez de "Pagas"; Próximos meses e Compras parceladas foram para a coluna da esquerda em Contas (equilíbrio do desktop); sugestão de cheque/cartão sem "Parcela".
Task 16: Verificado no navegador (demo nova): Hoje com 3 compras para revisar e 3 avisos; Contas com parcelada (renomear → "iPhone pessoal" em todas as parcelas e no "Termina"); Dívidas com 2 sugestões e, após "Enviar Registrato › Usar exemplo", 4 sugestões com o consignado fundido ("do Registrato", saldo R$ 18.400, parcela R$ 610 · faltam 17).
Task 16: complete (commits fa394fc..4dbfe44, tests: pnpm test →    Duration  4.54s (tests 80%, import 10%, transform 9%, worker 1%))
Final review: recebida (Opus). Critical: 0. Important: 8 (re-graduados como Important — todos afetam dinheiro mostrado, privacidade ou 'nada some'). Minor: 10.
Final: fixed 1 compra da fatura/banco não casava de novo (contagem dupla) — relacionar "compra registrada pela fatura em PDF ou pelo banco… também casa" RED→GREEN, suite 409/409
Final: fixed 2 PDF sem cartão não juntava com o cartão conectado — documentos "PDF sem cartão escolhido vai para o único cartão…" e sincronizar "ao conectar o cartão, a parcelada e a fatura do PDF…" RED→GREEN, suite 409/409
Final: fixed 3 campos "confira" entravam nos cálculos (taxa 0%) — banco-acoes "não aceita dívida com juros ou saldo ainda a conferir" RED→GREEN, suite 409/409
Final: fixed 4 produto opcional da Pluggy derrubava a sincronização — sincronizar "um produto opcional que falha…" RED→GREEN, suite 409/409
Final: fixed 5 profissional via a fatura do banco sem compartilhamento — banco-acoes "a profissional não vê a fatura do banco…" RED→GREEN, suite 409/409
Final: fixed 6 desconectar deixava correções, faturas do banco e avisos — bancos "desconectar não deixa sobras…" RED→GREEN, suite 409/409
Final: fixed 7 chamadas à Pluggy sem prazo — pluggy "comPrazoDe desiste quando a Pluggy não responde" RED→GREEN (toda chamada do cliente real tem prazo; limpeza da demo/conta espera no máximo 5 s), suite 409/409
Final: fixed 8 salvar documento apagava a fatura antiga antes de gravar a nova — documentos "se gravar a fatura de novo falhar no meio, a anterior não some" RED→GREEN, suite 409/409
Final: Ruling: no achado 1b (PENDING apagado e recriado), mantido apagarMovimentos apagando também os registrados — com o achado 1 corrigido, a transação recriada casa com a compra (via "banco") que ficou sem movimento, sem aviso novo — custo se errado: se a recriada vier com valor/data diferente além da folga, pede emoção de novo.
Final: Ruling: no achado 4, movimentos cuja tratarCompraNova falhou no meio não são reprocessados (o revisor sugeriu marcar como tratados) — raro e fica em "histórico" sem perda de dado — custo se errado: uma compra pode ficar sem aviso.
Final: minor (deferred): transactions/updated não atualiza transações antigas (filtro createdAtFrom).
Final: minor (deferred): comentário de apagarMovimentos diz que só apaga as não registradas.
Final: minor (deferred): dividas.corrigir/aceitarSugestao não validam no servidor taxa ≤ 30% e parcelas inteiras ≤ 480.
Final: minor (deferred): parcelas do cartão da Pluggy sem trava (totalInstallments enorme/parcela > total).
Final: minor (deferred): OUTDATED tratado como "reconectar".
Final: minor (deferred): correção não some quando o banco manda valor coerente; "Conferir" só aparece com campos em confira; falta unique de Divida.chave por pessoa.
Final: minor (deferred): casamento de dívida frouxo quando uma parcela é 0 (dois empréstimos do mesmo banco podem virar um; dispensar silencia futuros).
Final: minor (deferred): duplo clique em aceitar/registrar pode duplicar.
Final: minor (deferred): ConferirDivida não volta "salvando" em erro e salva campo a campo.
Final: minor (deferred): texto bruto de erro da Pluggy chega ao navegador em ResultadoDaSincronizacao.erro.
Pós-entrega: Verificado com a Pluggy de verdade (rede liberada): janela abre centralizada, Sandbox › user-ok/password-ok conecta, "Achei 2 contas, 2 compras desta semana para revisar, 1 dívida encontrada", "Pluggy Bank" aparece na lista, um único banco.conectado no servidor.
Pós-entrega: Ruling: janela da Pluggy passou a usar pluggy-connect-sdk direto (init/destroy no efeito) no lugar de react-pluggy-connect — no modo de desenvolvimento do React o componente deles abria duas janelas sobrepostas; agora abre uma e fechar no X volta ao normal.
