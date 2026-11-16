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
cp .env.example .env.local   # só para a Luana com IA (/luana e WhatsApp); o app do Desafoga não precisa
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
| `/luana`, `/p` | Luana | Chat da Luana com IA (Gemini) e painel pelo link do WhatsApp |
| `/api/*` | Luana | Chat, leitura de fatura, áudio e webhooks do WhatsApp |

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
    contratos.ts          interfaces que as telas usam (trocar pela API não muda as telas)
    tipos.ts              tipos de domínio (persona, memória, aviso, mensagem…)
    mock/                 implementação simulada, guardada no navegador
  fixtures/desafoga/      dados fictícios tipados: 4 personas, dívidas, faturas, memória
  lib/
    finance/              motor financeiro em funções puras, com testes
    assistente/           regras da conversa da Luana, detecção de sofrimento, contexto da IA, com testes
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

## O que é simulado nesta etapa

- **Dados:** tudo é fictício (`src/fixtures/desafoga`). As datas são relativas a hoje, e as mudanças ficam no navegador (`localStorage`). "Recomeçar demonstração" volta ao início.
- **Login:** não existe. A entrada em `/` escolhe o perfil (Ana ou Paula Reis).
- **Assistente no app:** responde por regras locais (`src/lib/assistente`), não por IA. Ela entende "comprei pão 12", "e se eu pagar 200 a mais?", "plano", "juros", "resumo" e conversa livre usando a memória.
- **Leitura de fatura:** o arquivo enviado não sai do aparelho. Um extrato de exemplo fixo é lido no lugar dele.
- **Avisos ao responsável:** compra alta, sofrimento intenso no chat e sugestão de valor mensal aparecem no sino, só dentro da demonstração.

Saúde mental: se uma mensagem indicar sofrimento intenso, a Luana acolhe, indica o CVV (188) e o SAMU (192) e avisa o responsável. Ela nunca faz diagnóstico.

As simulações são educativas e não são recomendação de crédito ou investimento.

## Contribuindo

Fluxo de branches e ambientes em [CONTRIBUTING.md](CONTRIBUTING.md).

## Licença

[MIT](LICENSE)
