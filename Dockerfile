# Imagem do Desafoga. Usada pelo docker-compose (perfil "completo").
# Estágios: dependências -> migrações (roda `prisma migrate deploy`) ->
# construção (next build) -> app (só o necessário para rodar, sem root).

FROM node:24-alpine AS base
RUN npm install -g pnpm@11.1.2
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS dependencias
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml prisma.config.ts ./
COPY prisma ./prisma
# O postinstall gera o cliente do Prisma a partir do schema.
RUN pnpm install --frozen-lockfile

FROM dependencias AS migracoes
CMD ["pnpm", "prisma", "migrate", "deploy"]

FROM dependencias AS construcao
COPY . .
RUN pnpm build

FROM node:24-alpine AS app
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S desafoga && adduser -S desafoga -G desafoga
COPY --from=construcao --chown=desafoga:desafoga /app/.next/standalone ./
COPY --from=construcao --chown=desafoga:desafoga /app/.next/static ./.next/static
COPY --from=construcao --chown=desafoga:desafoga /app/public ./public
USER desafoga
EXPOSE 3000
CMD ["node", "server.js"]
