# GestorPublico — Guia de Setup

## Pré-requisitos

- **Node.js** >= 20
- **pnpm** >= 9 (`npm install -g pnpm`)
- **Docker Desktop** (para MySQL e Redis)

---

## 1. Instalar dependências

```bash
cd public_auditor
pnpm install
```

---

## 2. Subir o banco de dados e Redis

```bash
docker-compose up -d
```

Aguarde ~15 segundos para o MySQL inicializar. Verifique:

```bash
docker-compose ps
# mysql e redis devem aparecer como "healthy"
```

---

## 3. Rodar as migrations e seed

```bash
cd apps/api
npx knex --knexfile knexfile.ts migrate:latest
npx knex --knexfile knexfile.ts seed:run
```

Isso cria todas as tabelas e o usuário admin:
- **Email:** `admin@prefeitura.gov.br`
- **Senha:** `Admin@2025!`

---

## 4. Iniciar o sistema

### Opção A — Rodar tudo de uma vez (recomendado):

```bash
# Na raiz do projeto
pnpm dev
```

### Opção B — Separado:

```bash
# Terminal 1: API
cd apps/api && npx ts-node-dev --respawn --transpile-only src/server.ts

# Terminal 2: Web
cd apps/web && npx next dev
```

---

## 5. Acessar

| Serviço | URL |
|---|---|
| Landing page + Login | http://localhost:3000 |
| API | http://localhost:3001 |
| Health check | http://localhost:3001/health |

---

## 6. Primeira importação

1. Acesse http://localhost:3000
2. Faça login com `admin@prefeitura.gov.br` / `Admin@2025!`
3. Vá em **Importação** no menu lateral
4. Arraste ou selecione o arquivo PDF "Listagem de Pagamento"
5. Clique em **Importar Relatório**
6. Acompanhe o progresso em tempo real
7. Após concluído, acesse **Pagamentos** para ver os dados

---

## Estrutura do Projeto

```
public_auditor/
├── apps/
│   ├── api/          # Backend Node.js/Express
│   │   ├── src/
│   │   │   ├── etl/  # Pipeline ETL (extractor, transformer, validator, loader)
│   │   │   ├── jobs/ # BullMQ workers
│   │   │   └── ...
│   │   └── migrations/
│   └── web/          # Frontend Next.js 14
│       └── src/
│           ├── app/
│           │   ├── page.tsx            # Landing + Login
│           │   └── (dashboard)/        # Área protegida
│           └── components/
├── packages/
│   └── shared/       # Tipos TypeScript compartilhados
├── docker-compose.yml
└── .env
```

---

## Credenciais padrão

| Serviço | Usuário | Senha |
|---|---|---|
| Sistema | admin@prefeitura.gov.br | Admin@2025! |
| MySQL (root) | root | root123 |
| MySQL (app) | auditor | auditor123 |

> ⚠️ **Altere todas as senhas antes de ir para produção!**

---

## Verificação end-to-end

Após importar o PDF "01 - Listagem de Pagamento.pdf":

- **Total registros:** 52
- **Valor Bruto:** R$ 2.490.412,99
- **Valor Retido:** R$ 540.011,47
- **Valor Líquido:** R$ 1.950.401,52

Se re-importar o mesmo arquivo, **0 novos registros** devem ser inseridos (deduplicação por hash SHA-256).
