FROM node:20-alpine AS base
WORKDIR /app
RUN npm install -g pnpm@9

# Copy root workspace files
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/config ./packages/config
COPY apps/api ./apps/api
COPY infra/migrations ./infra/migrations

# Install dependencies and build
RUN pnpm --filter @orbit/api install --frozen-lockfile
RUN pnpm --filter @orbit/api build

FROM node:20-alpine AS runner
WORKDIR /app
RUN npm install -g pnpm@9

ENV NODE_ENV=production
ENV PORT=8080

COPY --from=base /app /app

EXPOSE 8080

CMD ["sh", "-c", "pnpm --filter @orbit/api db:migrate && pnpm --filter @orbit/api start"]
