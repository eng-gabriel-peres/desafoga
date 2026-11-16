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

Requisitos: Node 24 e pnpm 11.

```bash
pnpm install
cp .env.example .env.local   # GEMINI_API_KEY liga a IA; sem ela, a Luana responde por regras
pnpm dev
```

Abra http://localhost:3000 e escolha **Entrar como Ana** (app da pessoa) ou **Entrar como Paula Reis** (painel do responsável).

Outros comandos: `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build`.

## Rotas

O sistema tem duas áreas separadas: o app de quem usa e o painel de quem acompanha.

| Rota | Área | Tela |
|---|---|---|
| `/` | Entrada | Escolha do perfil da demonstração (no futuro, o login) |
| `/app/hoje` | Pessoa | Nota do dia, compras de hoje, atalho para as dívidas, semana e padrões |
| `/app/registrar` | Pessoa | Registrar compra em 3 passos: nome, valor e categoria; emoção; se era necessária |
| `/app/assistente` | Pessoa | Chat com a Luana no estilo WhatsApp |
| `/app/dividas` | Pessoa | Raio-x do mês, plano de quitação, lista de dívidas e custo emocional |
| `/app/dividas/fatura` | Pessoa | Enviar fatura: upload, leitura em 3 etapas e classificação das compras novas |
| `/painel` | Responsável | Pacientes: tabela no desktop, cartões no celular |
| `/painel/[id]` | Responsável | Resumo do paciente: indicadores, humor e gasto por dia, padrões e avisos |
| `/painel/[id]/dividas` | Responsável | Dívidas do paciente, só leitura, com "Sugerir valor mensal" |
| `/painel/[id]/memoria` | Responsável | Memória da assistente: características, tom, objetivo, anotações e teste |
| `/api/desafoga/[acao]` | API | Dados e conversa do Desafoga (uma ação por chamada, com o visitante no cabeçalho) |
| `/api/twilio/webhook`, `/api/whatsapp/webhook` | WhatsApp | Mensagens que chegam pelo WhatsApp |
| `/luana`, `/p` | Luana antiga | Chat web de antes e painel pelo link (o WhatsApp agora atende só pelo Desafoga) |

Pacientes da demonstração: `ana`, `carlos`, `lucia` e `rafael`.

## Estrutura de pastas

```
src/
  app/
    (desafoga)/           layout raiz do Desafoga (fonte, tokens claro/escuro, Letra maior)
      page.tsx            entrada da demonstração
      app/                área da pessoa (moldura com menu inferior / barra lateral)
      painel/             área do responsável
    (luana)/              chat da Luana com IA e painel pelo link (/luana, /p)
    api/                  rotas do chat, da fatura e do WhatsApp
  components/desafoga/
    ui/                   botões, painel, KPI, etiquetas, avatar, carinha SVG
    moldura/              moldura de cada área, menus, sino de avisos, Letra maior
    telas/                uma tela por arquivo (hoje, registrar, assistente, dívidas, fatura, pacientes, resumo, memória)
    dividas/, chat/       partes das telas de dívidas e do chat
  hooks/                  consulta à camada de serviço, data atual, paciente aberto, Letra maior
  services/
    contratos.ts          interfaces que as telas usam
    tipos.ts              tipos de domínio (persona, memória, aviso, mensagem…)
    nucleo.ts             operações sobre os dados, iguais no servidor e no navegador
    api/                  implementação padrão: chama /api/desafoga
    mock/                 implementação local, sem servidor (NEXT_PUBLIC_DESAFOGA_DADOS=local)
  fixtures/desafoga/      dados fictícios tipados: 4 personas, dívidas, faturas, memória
  lib/
    finance/              motor financeiro em funções puras, com testes
    assistente/           regras da conversa da Luana, detecção de sofrimento, contexto da IA, com testes
    desafoga/             conversa com IA, leitura de fatura, telefone; servidor/ (banco, ações, rotas, WhatsApp)
    luana/, ia/, whatsapp/, twilio/   a Luana com IA e o WhatsApp
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

## A Luana no app e no WhatsApp

A Luana é a mesma nos dois canais: mesmo código no servidor (`src/lib/desafoga`), mesma memória do profissional e mesmos números.

- **Dados unificados:** no cadastro, a pessoa informa o número de WhatsApp (hoje, em "Conectar WhatsApp", no chat do app). A Luana manda um código para esse WhatsApp e a pessoa digita o código no app; só então o número fica ligado à conta, para ninguém conectar o número de outra pessoa. A partir daí, tudo o que ela manda por esse número (compras, faturas, áudios) cai na conta dela e aparece no app e no painel do responsável.
- **Conversas separadas:** o chat do app e o do WhatsApp são conversas diferentes. Uma pergunta em aberto num canal não se mistura com o outro.
- **IA lê, código calcula:** o Gemini lê gastos escritos do jeito da pessoa ("almoço 35 e uber 18,50"), faturas, prints e áudios, e conversa usando a memória. Plano, simulações, juros, o registro de compras (com emoção e necessidade) e a resposta a sofrimento intenso seguem por regras, com os números de `src/lib/finance`. Sem `GEMINI_API_KEY`, ou com a IA fora do ar, as regras respondem tudo.
- **Webhooks:** `/api/twilio/webhook` (sandbox da Twilio) e `/api/whatsapp/webhook` (Meta). Número sem conta recebe um aviso de que não está conectado e o link da plataforma para se cadastrar.

Para a demonstração com o sandbox da Twilio: preencha `NEXT_PUBLIC_WHATSAPP_NUMERO` e `NEXT_PUBLIC_WHATSAPP_CODIGO` (código do "join"), mande `join <código>` para o número do sandbox, conecte o seu número na conta da Ana, digite o código que chegar no WhatsApp e converse com a Luana pelo WhatsApp.

## O que ainda é simulado

- **Dados:** são fictícios (`src/fixtures/desafoga`), com datas relativas a hoje. Cada navegador ganha a sua cópia no servidor (Postgres com `DATABASE_URL`; sem ele, `.data/desafoga.json`). "Recomeçar demonstração" volta ao início e mantém o WhatsApp cadastrado.
- **Login:** não existe. A entrada em `/` escolhe o perfil (Ana ou Paula Reis). O número de WhatsApp fica em "Conectar WhatsApp" até o cadastro existir.
- **Sem IA:** a leitura de fatura usa um extrato de exemplo e o áudio não é transcrito. A tela avisa quando isso acontece.
- **Avisos ao responsável:** compra alta, sofrimento intenso e sugestão de valor mensal aparecem no sino; ainda não chegam por e-mail ou WhatsApp ao profissional.

Saúde mental: se uma mensagem indicar sofrimento intenso, a Luana acolhe, indica o CVV (188) e o SAMU (192) e avisa o responsável. Ela nunca faz diagnóstico.

As simulações são educativas e não são recomendação de crédito ou investimento.

## Contribuindo

Fluxo de branches e ambientes em [CONTRIBUTING.md](CONTRIBUTING.md).

## Licença

[MIT](LICENSE)
