# Azure RBAC Manager

A web application to manage Azure Role-Based Access Control — assign and revoke roles for users across subscriptions, resource groups, and resources, with a full audit trail.

## Features

- Browse Azure AD users and their current role assignments
- Assign Azure built-in or custom roles at any scope (subscription / resource group / resource)
- Revoke role assignments with one click
- Full audit log of every change made through the app
- Deployed to Azure (App Service + Static Web Apps) via Terraform and GitHub Actions

## Tech Stack

| | |
|-|-|
| **Backend** | Node.js 20, Express, TypeScript, Prisma, PostgreSQL |
| **Frontend** | React 18, Vite, Tailwind CSS, TanStack Query |
| **IaC** | Terraform → Azure App Service, Static Web Apps, PostgreSQL, Key Vault |
| **CI/CD** | GitHub Actions |

## Quick Start (local)

```bash
# 1. Install dependencies
cd api && npm install
cd ../web && npm install

# 2. Copy and fill in Azure credentials
cp api/.env.example api/.env

# 3. Start Postgres
docker compose up -d db

# 4. Migrate DB & generate Prisma client
cd api && npx prisma migrate dev && npx prisma generate

# 5. Start API (http://localhost:3000)
npm run dev

# 6. In a new terminal — start the frontend (http://localhost:5173)
cd web && npm run dev
```

See [CLAUDE.md](./CLAUDE.md) for full development guide, API reference, and Azure architecture details.

## Azure Setup

The service principal used by this app needs:

- **User Access Administrator** (or Owner) on the subscription — to create/delete role assignments
- **Microsoft Graph — User.Read.All** — to list Azure AD users

```bash
# Create service principal
az ad sp create-for-rbac \
  --name "azure-rbac-manager" \
  --role "User Access Administrator" \
  --scopes /subscriptions/<subscription-id> \
  --sdk-auth
```

Add the output JSON as `AZURE_CREDENTIALS` in GitHub Actions secrets, then add the individual fields as separate secrets (see CLAUDE.md for the full list).

## Deploy

```bash
cd infra
terraform init
terraform apply -var-file=environments/prod.tfvars \
  -var="db_admin_user=..." \
  -var="db_admin_password=..." \
  -var="azure_tenant_id=..." \
  -var="azure_client_id=..." \
  -var="azure_client_secret=..."
```

After the first `apply`, add the `static_web_app_api_token` output value to GitHub secrets as `AZURE_STATIC_WEB_APPS_API_TOKEN`. Subsequent deploys happen automatically on push to `main`.

<!---
ConstevoTechnologies/ConstevoTechnologies is a ✨ special ✨ repository because its `README.md` (this file) appears on your GitHub profile.
You can click the Preview link to take a look at your changes.
--->
