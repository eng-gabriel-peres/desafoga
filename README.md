# Desafoga

Finanças pessoais para quem está endividado e compra por impulso. O Desafoga junta três coisas que nenhum app junta:

1. **A emoção em cada compra.** A pessoa marca como estava (de 1, muito triste, a 5, muito feliz) e vê a **nota do dia**, a média das emoções das compras do dia.
2. **As dívidas.** Leitura de fatura, raio-x dos juros e plano de quitação.
3. **Um profissional acompanhando.** Psicólogo ou economista escreve uma **memória** que a assistente usa para conversar com a pessoa.

A assistente se chama **Luana** e conversa pelo WhatsApp e por um chat web igual ao WhatsApp.

Projeto do Hack Brasil 2026, trilha 05, Pagamentos & finanças.

**Demo:** https://desafoga-nine.vercel.app

## Regra de arquitetura

**A IA lê, o código calcula.** Nenhum número financeiro sai da IA. Juros, simulações, nota do dia e custo emocional vêm de funções puras e testadas em `src/lib/finance/`. A assistente só usa os números que o sistema entrega, como mostra o bloco "Ver o que o assistente recebe" na tela de memória.

## Rodando localmente

Requisitos: Node 24, pnpm 11 e Docker.

```bash
pnpm install
cp .env.example .env.local    # já vem apontando para o Postgres do Docker
pnpm db:up                    # sobe o Postgres (porta 5440) com o banco de testes
pnpm db:migrate               # cria as tabelas
pnpm dev
```

No `.env.local`, use `DATABASE_URL=postgresql://desafoga:desafoga@localhost:5440/desafoga` e `TEST_DATABASE_URL=postgresql://desafoga:desafoga@localhost:5440/desafoga_teste`. `GEMINI_API_KEY` liga a IA; sem ela, a Luana responde por regras.

Abra http://localhost:3000. Para testar sem cadastro, toque em **Entrar como Ana** (app da pessoa) ou **Entrar como Paula Reis** (painel de quem acompanha). Para usar de verdade, **Criar minha conta**.

Tudo em containers (banco, migrações e app em http://localhost:3000): `docker compose --profile completo up --build`.

| Comando | O que faz |
|---|---|
| `pnpm db:up` / `pnpm db:down` | Sobe e desliga o Postgres do Docker |
| `pnpm db:migrate` | Cria uma migração nova a partir do schema e aplica (desenvolvimento) |
| `pnpm db:deploy` | Aplica as migrações existentes (CI, Vercel, Docker) |
| `pnpm db:seed` | Cria um espaço com os dados de demonstração |
| `pnpm db:studio` | Abre o Prisma Studio para olhar o banco |
| `pnpm test` | Testes; com `TEST_DATABASE_URL`, também os de integração com o Postgres |
| `pnpm lint`, `pnpm typecheck`, `pnpm build` | Verificações do CI |

## Banco de dados e contas

- **Postgres + Prisma 7** (`prisma/schema.prisma`, migrações em `prisma/migrations`). Em produção, Neon na Vercel; o `vercel-build` aplica as migrações antes do build. Localmente e no CI, Postgres no Docker.
- **Espaços:** cada "Entrar como Ana/Paula" cria uma cópia própria dos dados fictícios (espaço DEMO, apagado depois de 7 dias); as contas criadas de verdade ficam no espaço REAL.
- **Sem senha, por decisão do hackathon:** a conta é criada com nome e consentimento, e o navegador lembra dela por um cookie httpOnly; no banco fica só o hash do token. Evite computador compartilhado. A próxima etapa é entrar pelo WhatsApp com código, que já existe para conectar o número.
- **Permissões em toda ação** (`src/lib/desafoga/servidor/acesso.ts`): a pessoa só vê e muda os próprios dados; o profissional só vê quem aceitou o convite (código no painel, aceito em Perfil); a anotação é sempre em nome de quem está na sessão e só o autor apaga; notas privadas não chegam à pessoa nem à IA.
- **LGPD:** consentimento ao criar a conta, acompanhamento só com aceite da pessoa e "Apagar minha conta" em Perfil, que apaga tudo dela.
- **Segurança da API:** chamadas exigem o cabeçalho `x-desafoga` (barra pedidos forjados de outros sites); limites de uso por sessão, por rede (só quando o endereço é confiável: na Vercel, ou atrás de proxy declarado em `CONFIAR_NO_PROXY`) e tetos globais.

## Rotas

O sistema tem duas áreas separadas: o app de quem usa e o painel de quem acompanha.

| Rota | Área | Tela |
|---|---|---|
| `/` | Entrada | Demonstração sem cadastro (Ana, Paula, ou Carlos, Lúcia e Rafael, cada um com um tom da Luana) ou criar a conta |
| `/app/hoje` | Pessoa | Nota do dia, compras de hoje, atalho para as dívidas, semana e padrões |
| `/app/registrar` | Pessoa | Registrar compra em 3 passos: nome, valor e categoria; emoção; se era necessária. O "Registrar" do menu e da tela Hoje abre o mesmo registro por cima da tela atual (janela no desktop, tela cheia no celular), sem sair de onde a pessoa está |
| `/app/assistente` | Pessoa | Chat com a Luana no estilo WhatsApp |
| `/app/dividas` | Pessoa | Raio-x do mês, plano de quitação, lista de dívidas e custo emocional |
| `/app/metas` | Pessoa | Metas de economia (seção de metas do protótipo): anel, ritmo do plano, previsão; `nova`, `[id]` (detalhe e histórico) e `[id]/ajustar` |
| `/app/contas` | Pessoa | Contas do mês: contas fixas e parcelas do plano, pago e falta pagar, sobra da renda, calendário e "Paguei" |
| `/app/rotina` | Pessoa | Rotina e privacidade: horários dos check-ins (ao acordar, meio-dia, noite), aviso para quem acompanha e se as contas são compartilhadas |
| `/app/orcamento` | Pessoa | Limite do mês por categoria: quanto usou, quanto resta e quanto dá por dia (no desktop, pela barra lateral; no celular, pela tela Hoje) |
| `/app/perfil` | Pessoa | WhatsApp, quem acompanha (código de convite) e apagar a conta (também pelo menu da bolinha do perfil) |
| `/app/dividas/fatura` | Pessoa | Enviar fatura: upload, leitura em 3 etapas e classificação das compras novas |
| `/painel` | Responsável | Pacientes (tabela no desktop, cartões no celular) e código de convite |
| `/painel/[id]` | Responsável | Resumo do paciente: indicadores, humor e gasto por dia, padrões e avisos |
| `/painel/[id]/dividas` | Responsável | Dívidas do paciente, só leitura, com "Sugerir valor mensal" |
| `/painel/[id]/contas` | Responsável | Contas do paciente, só leitura e só se a pessoa compartilhar |
| `/painel/[id]/metas` | Responsável | Metas do paciente, só leitura, com "Mandar incentivo" |
| `/painel/[id]/memoria` | Responsável | Memória da assistente: características, tom, objetivo, anotações e teste |
| `/api/desafoga/[acao]` | API | Dados e conversa do Desafoga (uma ação por chamada; sessão por cookie) |
| `/api/twilio/webhook`, `/api/whatsapp/webhook` | WhatsApp | Mensagens que chegam pelo WhatsApp |
| `/luana`, `/p` | Luana antiga | Chat web de antes e painel pelo link (o WhatsApp agora atende só pelo Desafoga) |

Na demonstração, a Paula acompanha Ana, Carlos, Lúcia e Rafael; os ids das páginas de paciente são os do banco.

## Estrutura de pastas

```
src/
  app/
    (desafoga)/           layout raiz do Desafoga (fonte, tokens claro/escuro)
      page.tsx            entrada: demonstração ou criar conta
      app/                área da pessoa (moldura: barra flutuante no celular, barra lateral no desktop)
      painel/             área do responsável
    (luana)/              chat da Luana com IA e painel pelo link (/luana, /p)
    api/                  rotas do chat, da fatura e do WhatsApp
  components/desafoga/
    ui/                   botões, painel, KPI, etiquetas, avatar, carinha SVG
    moldura/              moldura de cada área, menus, sino de avisos, menu do perfil
    telas/                uma tela por arquivo (hoje, registrar, assistente, dívidas, fatura, perfil, pacientes, resumo, memória)
    dividas/, chat/       partes das telas de dívidas (inclui o cadastro de dívidas) e do chat
    sessao.tsx            quem está usando o app; manda para a entrada quem não tem o perfil da área
  hooks/                  consulta à camada de serviço, data atual, paciente aberto
  services/
    contratos.ts          interfaces que as telas usam
    tipos.ts              tipos de domínio (persona, memória, aviso, mensagem…)
    api/                  implementação: chama /api/desafoga
  fixtures/desafoga/      dados fictícios tipados da demonstração: 4 personas, dívidas, faturas, memória
  generated/prisma/       cliente gerado pelo Prisma (pnpm install / prisma generate; fora do git)
  lib/
    finance/              motor financeiro em funções puras, com testes
    assistente/           regras da conversa da Luana, detecção de sofrimento, contexto da IA, com testes
    desafoga/             conversa com IA, leitura de fatura, telefone, regras
      servidor/           repositório (Prisma), sessão, permissões, rotas da API, WhatsApp, semente da demo
    luana/, ia/, whatsapp/, twilio/   a Luana com IA e o WhatsApp
prisma/                   schema, migrações e seed da demonstração
docker-compose.yml, Dockerfile   Postgres local e o projeto completo em containers
docs/referencia/          protótipo usado como referência visual
```

### Motor financeiro (`src/lib/finance`)

Valores em centavos e taxas como fração ao mês. Cada função tem teste.

- `jurosDoMes`, `jurosMensaisTotais`, `dividaMaisCara`: juros do mês.
- `simularQuitacao`: simulação mês a mês. Paga os mínimos e manda o restante para a dívida da estratégia (mais cara primeiro ou menor primeiro).
- `projecaoSoMinimo`: juros dos próximos 12 meses pagando só o mínimo.
- `compararExtra`: só o mínimo contra o mínimo mais um valor extra.
- `encargosDasFaturas`, `custoEmocional`, `separarFatura`: juros, IOF, tarifas e quanto dos juros veio de compras feitas com emoção 1 ou 2.
- `notaDoDia`, `resumoDaSemana`, `situacaoDoPaciente`, `padroesDeCompra`: emoção, semana e situação do paciente.
- `situacaoDoOrcamento`, `orcamentoDoMes`, `resumoDoOrcamento`: quanto do limite da categoria foi usado no mês, quanto resta e o limite diário até o fim do mês.
- `compromissosDoMes`, `totaisDoMes`, `gruposDeVencimento`, `contasPorCategoria`: contas fixas e parcelas do plano no mês (paga, vencida, vence em breve, débito automático), quanto falta pagar e quanto sobra da renda.
- `checkInDe`, `jaEHora`, `PERIODOS`: os três check-ins do dia e os horários da rotina.
- `situacaoDaMeta`, `opcoesParaPrazo`, `previsaoDeTermino`: guardado, falta, em dia/adiantada/atrasada, quanto guardar por dia, semana ou mês até a data e quando a meta termina.

## A Luana no app e no WhatsApp

A Luana é a mesma nos dois canais: mesmo código no servidor (`src/lib/desafoga`), mesma memória do profissional e mesmos números.

- **Dados unificados:** no cadastro, a pessoa informa o número de WhatsApp (hoje, em "Conectar WhatsApp", no chat do app). A Luana manda um código para esse WhatsApp e a pessoa digita o código no app; só então o número fica ligado à conta, para ninguém conectar o número de outra pessoa. Contra spam e tentativa e erro: o código só vai para números que falaram com a Luana nas últimas 24 horas; cada navegador pode pedir 5 códigos e errar 10 vezes por número no dia (com um teto alto por número, para outra pessoa não conseguir travar o dono); cada código vale 15 minutos e 5 tentativas; envio que falhou não conta. A partir daí, tudo o que ela manda por esse número (compras, faturas, áudios) cai na conta dela e aparece no app e no painel do responsável.
- **Número errado e arrependimento:** antes de enviar o código, o app mostra o número formatado para conferir; número que nunca falou com a Luana nem recebe código (a pessoa é avisada para conferir); "Errei o número" invalida o código na hora. Ao conectar, a Luana avisa aquele WhatsApp da conexão (com texto fixo), e quem tem o número pode responder "desconectar" a qualquer momento (no app, Perfil > WhatsApp > Desconectar).
- **Metas e orçamento:** "guardei 50" ou "transferi 1k pra reserva" registra o dinheiro na meta num movimento só (a transferência já conta na meta); com mais de uma meta ativa, a Luana pergunta qual. Depois de registrar uma compra, ela diz quanto resta do orçamento daquela categoria e o limite diário até o fim do mês.
- **Contas e check-ins:** "paguei luz 87,50" marca a conta do mês com o valor pago; "paguei" sozinho marca a próxima que vence (conta ou parcela); sem conta com esse nome, vira compra ("paguei 30 no uber"). Responder o check-in pelo app deixa a pergunta, a resposta e o retorno da Luana no chat; resposta 1 ou 2 avisa quem acompanha, se a pessoa deixar.
- **Conversas separadas:** o chat do app e o do WhatsApp são conversas diferentes. Uma pergunta em aberto num canal não se mistura com o outro.
- **IA lê, código calcula:** o Gemini lê gastos escritos do jeito da pessoa ("almoço 35 e uber 18,50"), faturas, prints e áudios, e conversa usando a memória. Plano, simulações, juros, o registro de compras (com emoção e necessidade) e a resposta a sofrimento intenso seguem por regras, com os números de `src/lib/finance`. Sem `GEMINI_API_KEY`, ou com a IA fora do ar, as regras respondem tudo.
- **Webhooks:** `/api/twilio/webhook` (sandbox da Twilio) e `/api/whatsapp/webhook` (Meta). Número sem conta recebe um aviso de que não está conectado e o link da plataforma para se cadastrar e conectar o WhatsApp pelo app.

Para a demonstração com o sandbox da Twilio: preencha `NEXT_PUBLIC_WHATSAPP_NUMERO` e `NEXT_PUBLIC_WHATSAPP_CODIGO` (código do "join"), mande `join <código>` para o número do sandbox, conecte o seu número na conta da Ana, digite o código que chegar no WhatsApp e converse com a Luana pelo WhatsApp.

## O que ainda é simulado ou falta

- **Demonstração:** Ana, Carlos, Lúcia, Rafael, Paula e Marcos são fictícios (`src/fixtures/desafoga`), com datas relativas ao dia em que a demo é criada. Contas reais começam vazias.
- **Login sem senha:** decisão do hackathon para quem avalia testar sem cadastro. Para uso aberto ao público, falta entrar pelo WhatsApp com código ou e-mail.
- **Sem IA:** a leitura de fatura usa um extrato de exemplo e o áudio não é transcrito. A tela avisa quando isso acontece.
- **Avisos ao responsável:** compra alta, sofrimento intenso e sugestão de valor mensal aparecem no sino; ainda não chegam por e-mail ou WhatsApp ao profissional.
- **Mensagens nos horários:** os check-ins da rotina e o lembrete de conta "um dia antes" ainda não são enviados sozinhos pelo WhatsApp (falta um agendador); hoje a pessoa responde o check-in pelo cartão da tela Hoje.
- **Lembretes das metas:** a meta guarda se a pessoa quer lembrete, mas o envio automático nos dias de guardar ainda não existe (falta um agendador); hoje dá para pedir um lembrete na hora, no detalhe da meta.
- **Exportar os dados** (LGPD): apagar já existe; exportar ainda não.

Saúde mental: se uma mensagem indicar sofrimento intenso, a Luana acolhe, indica o CVV (188) e o SAMU (192) e avisa o responsável. Ela nunca faz diagnóstico.

As simulações são educativas e não são recomendação de crédito ou investimento.

## Contribuindo

Fluxo de branches e ambientes em [CONTRIBUTING.md](CONTRIBUTING.md).

## Licença

[MIT](LICENSE)
