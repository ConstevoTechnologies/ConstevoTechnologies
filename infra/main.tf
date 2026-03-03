terraform {
  required_version = ">= 1.6"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.85"
    }
  }

  # Remote state — create the storage account once manually before first apply
  backend "azurerm" {
    resource_group_name  = "rg-terraform-state"
    storage_account_name = "stterraformstate"
    container_name       = "tfstate"
    key                  = "azure-rbac-manager.tfstate"
  }
}

provider "azurerm" {
  features {}
}

data "azurerm_client_config" "current" {}

locals {
  tags = {
    app         = var.app_name
    environment = var.environment
    managed_by  = "terraform"
  }
  name_suffix = "${var.app_name}-${var.environment}"
}

# ── Resource Group ───────────────────────────────────────────────────────────

resource "azurerm_resource_group" "main" {
  name     = "rg-${local.name_suffix}"
  location = var.location
  tags     = local.tags
}

# ── PostgreSQL Flexible Server ────────────────────────────────────────────────

resource "azurerm_postgresql_flexible_server" "main" {
  name                   = "psql-${local.name_suffix}"
  resource_group_name    = azurerm_resource_group.main.name
  location               = azurerm_resource_group.main.location
  version                = "15"
  administrator_login    = var.db_admin_user
  administrator_password = var.db_admin_password
  storage_mb             = 32768
  sku_name               = var.environment == "prod" ? "GP_Standard_D2s_v3" : "B_Standard_B1ms"
  tags                   = local.tags
}

resource "azurerm_postgresql_flexible_server_database" "main" {
  name      = "azure_rbac"
  server_id = azurerm_postgresql_flexible_server.main.id
  charset   = "UTF8"
  collation = "en_US.utf8"
}

# Allow App Service outbound IPs (firewall rule added separately after deploy)
resource "azurerm_postgresql_flexible_server_firewall_rule" "allow_azure" {
  name             = "allow-azure-services"
  server_id        = azurerm_postgresql_flexible_server.main.id
  start_ip_address = "0.0.0.0"
  end_ip_address   = "0.0.0.0"
}

# ── Key Vault ─────────────────────────────────────────────────────────────────

resource "azurerm_key_vault" "main" {
  name                        = "kv-${local.name_suffix}"
  resource_group_name         = azurerm_resource_group.main.name
  location                    = azurerm_resource_group.main.location
  tenant_id                   = data.azurerm_client_config.current.tenant_id
  sku_name                    = "standard"
  purge_protection_enabled    = var.environment == "prod"
  soft_delete_retention_days  = 7
  tags                        = local.tags
}

resource "azurerm_key_vault_access_policy" "terraform" {
  key_vault_id = azurerm_key_vault.main.id
  tenant_id    = data.azurerm_client_config.current.tenant_id
  object_id    = data.azurerm_client_config.current.object_id

  secret_permissions = ["Get", "Set", "List", "Delete", "Purge"]
}

resource "azurerm_key_vault_secret" "db_url" {
  name         = "database-url"
  value        = "postgresql://${var.db_admin_user}:${var.db_admin_password}@${azurerm_postgresql_flexible_server.main.fqdn}:5432/azure_rbac?sslmode=require"
  key_vault_id = azurerm_key_vault.main.id
  depends_on   = [azurerm_key_vault_access_policy.terraform]
}

resource "azurerm_key_vault_secret" "azure_client_secret" {
  name         = "azure-client-secret"
  value        = var.azure_client_secret
  key_vault_id = azurerm_key_vault.main.id
  depends_on   = [azurerm_key_vault_access_policy.terraform]
}

# ── Container Registry ────────────────────────────────────────────────────────

resource "azurerm_container_registry" "main" {
  name                = "acr${replace(local.name_suffix, "-", "")}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  sku                 = "Basic"
  admin_enabled       = true
  tags                = local.tags
}

# ── App Service Plan + Web App (API) ─────────────────────────────────────────

resource "azurerm_service_plan" "main" {
  name                = "asp-${local.name_suffix}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  os_type             = "Linux"
  sku_name            = var.environment == "prod" ? "B2" : "B1"
  tags                = local.tags
}

resource "azurerm_linux_web_app" "api" {
  name                = "app-${local.name_suffix}-api"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  service_plan_id     = azurerm_service_plan.main.id
  https_only          = true
  tags                = local.tags

  site_config {
    always_on = var.environment == "prod"

    application_stack {
      docker_image_name        = "${azurerm_container_registry.main.login_server}/${var.app_name}-api:latest"
      docker_registry_url      = "https://${azurerm_container_registry.main.login_server}"
      docker_registry_username = azurerm_container_registry.main.admin_username
      docker_registry_password = azurerm_container_registry.main.admin_password
    }
  }

  app_settings = {
    DATABASE_URL        = "@Microsoft.KeyVault(SecretUri=${azurerm_key_vault_secret.db_url.versionless_id})"
    AZURE_CLIENT_SECRET = "@Microsoft.KeyVault(SecretUri=${azurerm_key_vault_secret.azure_client_secret.versionless_id})"
    AZURE_TENANT_ID     = var.azure_tenant_id
    AZURE_CLIENT_ID     = var.azure_client_id
    CORS_ORIGIN         = "https://${azurerm_static_web_app.frontend.default_host_name}"
    NODE_ENV            = "production"
    PORT                = "3000"
    WEBSITES_PORT       = "3000"
  }

  identity {
    type = "SystemAssigned"
  }
}

# Grant App Service access to Key Vault secrets
resource "azurerm_key_vault_access_policy" "api" {
  key_vault_id = azurerm_key_vault.main.id
  tenant_id    = data.azurerm_client_config.current.tenant_id
  object_id    = azurerm_linux_web_app.api.identity[0].principal_id

  secret_permissions = ["Get"]
  depends_on         = [azurerm_linux_web_app.api]
}

# ── Static Web App (Frontend) ─────────────────────────────────────────────────

resource "azurerm_static_web_app" "frontend" {
  name                = "stapp-${local.name_suffix}"
  resource_group_name = azurerm_resource_group.main.name
  location            = "eastus2" # Static Web Apps have limited regions
  sku_tier            = "Free"
  tags                = local.tags
}
