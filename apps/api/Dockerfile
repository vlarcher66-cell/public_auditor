FROM node:20-alpine

RUN npm install -g pnpm@9

WORKDIR /app

# Copiar arquivos de workspace
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

# Instalar dependências
RUN pnpm install --frozen-lockfile

# Build da API
RUN pnpm --filter @public-auditor/api build

WORKDIR /app/apps/api

EXPOSE 3001

CMD ["node", "dist/server.js"]
