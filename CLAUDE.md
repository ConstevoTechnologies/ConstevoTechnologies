# CLAUDE.md — AI Assistant Guide

## Project Overview

**Azure RBAC Manager** is a full-stack web application for managing Azure Role-Based Access Control.
It lets you assign and revoke Azure roles (Owner, Contributor, Reader, custom roles) for Azure AD users
across subscriptions, resource groups, and individual resources — with a full audit trail.

| Layer | Technology |
|-------|-----------|
| Backend API | Node.js 20, Express, TypeScript, Prisma ORM |
| Frontend | React 18, Vite, Tailwind CSS, TanStack Query |
| Database | PostgreSQL 15 (Azure Database for PostgreSQL Flexible Server) |
| IaC | Terraform (azurerm provider ~3.85) |
| CI/CD | GitHub Actions |
| Container | Docker, Azure Container Registry |
| Hosting | Azure App Service (API) + Azure Static Web Apps (frontend) |

---

## Repository Structure

```
.
├── api/                          # Express REST API (TypeScript)
│   ├── src/
│   │   ├── routes/               # Route handlers
│   │   │   ├── subscriptions.ts  # GET subscriptions, resource groups, resources
│   │   │   ├── users.ts          # GET Azure AD users (via Graph API)
│   │   │   ├── roles.ts          # GET role definitions
│   │   │   ├── assignments.ts    # GET / POST / DELETE role assignments
│   │   │   └── audit.ts          # GET audit log
│   │   ├── services/
│   │   │   ├── azureClient.ts    # AuthorizationClient, ResourceClient, SubscriptionClient
│   │   │   ├── graphClient.ts    # Microsoft Graph client (for AAD users)
│   │   │   └── prisma.ts         # Prisma singleton
│   │   ├── middleware/
│   │   │   └── errorHandler.ts   # Global Express error handler
│   │   ├── prisma/
│   │   │   └── schema.prisma     # DB schema (AuditLog model)
│   │   └── index.ts              # App entry point
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example              # Copy to .env for local dev
│
├── web/                          # React frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── Layout.tsx        # Sidebar + <Outlet>
│   │   │   ├── Sidebar.tsx       # Navigation
│   │   │   └── AssignRoleModal.tsx  # Role assignment form
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx     # Stats overview + recent activity
│   │   │   ├── Assignments.tsx   # List / create / delete role assignments
│   │   │   ├── Users.tsx         # Browse AAD users + expand to see their roles
│   │   │   └── AuditLog.tsx      # Paginated audit trail
│   │   ├── services/
│   │   │   └── api.ts            # Axios client (all API calls)
│   │   ├── types/
│   │   │   └── index.ts          # Shared TypeScript interfaces
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── vite.config.ts            # Dev proxy → localhost:3000
│   ├── tailwind.config.js
│   └── package.json
│
├── infra/                        # Terraform (Azure)
│   ├── main.tf                   # All resources
│   ├── variables.tf
│   ├── outputs.tf
│   └── environments/
│       ├── dev.tfvars
│       └── prod.tfvars
│
├── .github/
│   └── workflows/
│       ├── ci.yml                # PR: lint + type-check + test + docker build
│       └── deploy.yml            # main: build image → terraform apply → deploy
│
├── docker-compose.yml            # Local Postgres + API
├── .gitignore
└── CLAUDE.md                     # This file
```

---

## Local Development Setup

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- Azure credentials (service principal — see `.env.example`)

### Steps

```bash
# 1. Clone and install
cd api && npm install
cd ../web && npm install

# 2. Configure environment
cp api/.env.example api/.env
# Fill in AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET

# 3. Start Postgres
docker compose up -d db

# 4. Run migrations and generate Prisma client
cd api && npx prisma migrate dev && npx prisma generate

# 5. Start API  (http://localhost:3000)
cd api && npm run dev

# 6. Start frontend  (http://localhost:5173)
cd web && npm run dev
```

---

## Common Commands

### API (`api/`)

```bash
npm run dev            # Start with hot-reload (ts-node-dev)
npm run build          # Compile TypeScript → dist/
npm run start          # Run compiled output
npm run lint           # ESLint
npm run lint:fix       # ESLint --fix
npm test               # Jest (--passWithNoTests)
npx tsc --noEmit       # Type-check without building

npx prisma migrate dev --name <name>   # Create + apply a new migration
npx prisma migrate deploy              # Apply migrations (production)
npx prisma generate                    # Regenerate client after schema change
npx prisma studio                      # GUI DB browser
```

### Frontend (`web/`)

```bash
npm run dev      # Vite dev server (proxies /api → localhost:3000)
npm run build    # Production build → dist/
npm run preview  # Preview production build locally
npm run lint     # ESLint
```

### Terraform (`infra/`)

```bash
terraform init
terraform plan  -var-file=environments/dev.tfvars  -var="db_admin_user=..." ...
terraform apply -var-file=environments/dev.tfvars  -var="db_admin_user=..." ...

# Production — always confirm with user before running
terraform apply -var-file=environments/prod.tfvars ...

# DANGEROUS — ask user before running, it destroys live infrastructure
terraform destroy ...
```

---

## API Reference

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/subscriptions` | List Azure subscriptions |
| `GET` | `/api/subscriptions/:subId/resource-groups` | List resource groups |
| `GET` | `/api/subscriptions/:subId/resource-groups/:rgName/resources` | List resources |
| `GET` | `/api/users?search=` | List Azure AD users (Graph API) |
| `GET` | `/api/roles?subscriptionId=` | List role definitions at subscription scope |
| `GET` | `/api/assignments?subscriptionId=&scope=&principalId=` | List role assignments |
| `POST` | `/api/assignments` | Create role assignment |
| `DELETE` | `/api/assignments/:name?subscriptionId=&scope=` | Delete role assignment |
| `GET` | `/api/audit?limit=&offset=` | Paginated audit log |

---

## Azure Architecture

```
GitHub Actions
    ├─► Azure Container Registry  ← Docker image (API)
    ├─► Azure App Service         ← Backend API (pulls from ACR)
    ├─► Azure Static Web Apps     ← React frontend
    ├─► Azure Database (Postgres) ← Prisma ORM
    ├─► Azure Key Vault           ← DATABASE_URL, AZURE_CLIENT_SECRET
    └─► Microsoft Graph API       ← Azure AD user lookup
```

### Required Azure Service Principal Permissions

| Permission | Where | Why |
|-----------|-------|-----|
| `User Access Administrator` | Subscription | Create/delete role assignments |
| `Reader` | Subscription | List resources, subscriptions |
| `User.Read.All` | Microsoft Graph | List AAD users |

### Environment → Branch → Azure Resource Group

| Env | Branch | Resource Group |
|-----|--------|---------------|
| dev | `dev` | `rg-azurerbacmgr-dev` |
| staging | `staging` | `rg-azurerbacmgr-staging` |
| prod | `main` | `rg-azurerbacmgr-prod` |

---

## Required GitHub Actions Secrets

| Secret | Description |
|--------|-------------|
| `AZURE_CREDENTIALS` | Service principal JSON (`az ad sp create-for-rbac --sdk-auth`) |
| `AZURE_TENANT_ID` | Azure AD tenant ID |
| `AZURE_CLIENT_ID` | Service principal client ID |
| `AZURE_CLIENT_SECRET` | Service principal client secret |
| `AZURE_SUBSCRIPTION_ID` | Target subscription ID |
| `REGISTRY_LOGIN_SERVER` | ACR login server URL |
| `REGISTRY_USERNAME` | ACR admin username |
| `REGISTRY_PASSWORD` | ACR admin password |
| `DB_ADMIN_USER` | PostgreSQL admin login |
| `DB_ADMIN_PASSWORD` | PostgreSQL admin password |
| `DATABASE_URL` | Full production connection string (for migrations) |
| `AZURE_STATIC_WEB_APPS_API_TOKEN` | From `terraform output static_web_app_api_token` |

---

## Database Conventions

- **ORM**: Prisma — schema at `api/src/prisma/schema.prisma`
- **Only model**: `AuditLog` — records every ASSIGN / REVOKE done through the app
- **Migrations**: Always use `prisma migrate dev --name <descriptive-name>` locally.
  Never hand-edit migration files after they are committed.
- **Prisma client**: Run `npx prisma generate` after any schema change.

---

## Key Conventions for AI Assistants

1. **Always run `npm run lint` and `npx tsc --noEmit`** in the relevant package after code changes.
2. **Never hardcode secrets** — use `process.env.VAR` (API) or `import.meta.env.VITE_VAR` (frontend).
3. **Never run `terraform destroy`** without explicit user confirmation.
4. **Never run `terraform apply` with `prod.tfvars`** without explicit user confirmation.
5. **Prisma schema changes require a migration** — edit `schema.prisma`, then:
   `npx prisma migrate dev --name <name>` and `npx prisma generate`.
6. **No `any` types** — the codebase is strict TypeScript; add proper types.
7. **API changes must be reflected in `web/src/services/api.ts` and `web/src/types/index.ts`.**
8. **Never push directly to `main`** — always use a branch and PR.
9. **Branch naming**: `claude/<short-description>-<sessionId>` for AI-generated branches.
10. **Docker**: The API container runs as a non-root user (`appuser`). Don't require root at runtime.

---

## Common Tasks

| Task | Steps |
|------|-------|
| Add a new API route | Create file in `api/src/routes/`, register in `api/src/index.ts` |
| Add a DB column | Edit `schema.prisma`, run `prisma migrate dev --name <name>`, run `prisma generate` |
| Add a new frontend page | Create in `web/src/pages/`, add `<Route>` in `web/src/App.tsx`, add nav link in `Sidebar.tsx` |
| Add an env var | Add to `api/.env.example`, update `api/src/index.ts` or relevant service, add to Azure App Service config, add to GitHub Actions secrets |
| Add a Terraform resource | Edit `infra/main.tf`, run `terraform plan` on dev first |
| Roll back API deployment | Redeploy a previous Docker tag from ACR via `az webapp config container set` |

---

## Useful Azure CLI Commands

```bash
# Login
az login
az account set --subscription "<subscription-id>"

# App Service logs
az webapp log tail --name app-azurerbacmgr-prod-api --resource-group rg-azurerbacmgr-prod

# Restart API
az webapp restart --name app-azurerbacmgr-prod-api --resource-group rg-azurerbacmgr-prod

# Check deployed container image
az webapp config container show --name app-azurerbacmgr-prod-api --resource-group rg-azurerbacmgr-prod

# List Key Vault secrets
az keyvault secret list --vault-name kv-azurerbacmgr-prod

# List role assignments (direct Azure CLI — bypasses this app)
az role assignment list --subscription "<sub-id>" --output table
```
