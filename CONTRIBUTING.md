# Como trabalhamos

## Ambientes

| Ambiente | Branch | Onde roda | Banco |
|---|---|---|---|
| local | a sua | `pnpm dev` na sua máquina | branch `dev` do Neon |
| dev | `develop` | Vercel (Preview da branch `develop`) | branch `dev` do Neon |
| prod | `main` | Vercel (Production) | branch `main` do Neon |

`GET /api/health` responde em qual ambiente você está.

## Fluxo

1. Atualize a `develop` e crie sua branch a partir dela:
   `git switch develop && git pull && git switch -c feat/leitura-de-fatura`
2. Desenvolva e teste localmente (`pnpm dev`, `pnpm test`).
3. Abra um PR para `develop`. O CI precisa passar e outra pessoa do time precisa aprovar.
4. Com o merge, a Vercel publica em dev. Valide lá.
5. Para ir a prod, abra um PR de `develop` para `main`. Com o merge, a Vercel publica em prod.

Ninguém faz push direto em `develop` ou `main`.

## Nomes

- Branches: `feat/...`, `fix/...`, `chore/...`, `docs/...`
- Commits: [Conventional Commits](https://www.conventionalcommits.org/pt-br/) (`feat: ...`, `fix: ...`)
- PRs para `develop`: squash merge. PR de `develop` para `main`: merge commit, para manter o histórico igual.

## Regras do Hack Brasil que valem para cada commit

- Não copie código de repositório privado ou escrito antes de 4/11/2026 às 21h. Código aberto que já era público pode entrar, com a origem citada na mensagem do commit.
- Nada de dados pessoais reais. Use as faturas fictícias de `public/exemplos`.
- O repositório fica público pelo menos até 15/12/2026.
- Depois de 30/11 às 23h59 não fazemos commits até a final (12/12).

## Regra de arquitetura

A IA lê e conversa; o código calcula. Qualquer número mostrado ao usuário vem de `src/lib/sofia/resumo.ts`, que tem testes. O modelo só lê documentos, classifica e redige.
