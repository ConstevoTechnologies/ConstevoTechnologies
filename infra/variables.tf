variable "app_name" {
  description = "Application short name — used in all resource names (lowercase, no spaces)"
  type        = string
  default     = "azurerbacmgr"

  validation {
    condition     = can(regex("^[a-z0-9]+$", var.app_name))
    error_message = "app_name must be lowercase alphanumeric only."
  }
}

variable "environment" {
  description = "Deployment environment"
  type        = string

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be one of: dev, staging, prod."
  }
}

variable "location" {
  description = "Primary Azure region for all resources"
  type        = string
  default     = "westeurope"
}

variable "db_admin_user" {
  description = "PostgreSQL administrator login name"
  type        = string
  sensitive   = true
}

variable "db_admin_password" {
  description = "PostgreSQL administrator password (min 8 chars, mixed case + number + special)"
  type        = string
  sensitive   = true
}

variable "azure_tenant_id" {
  description = "Azure AD tenant ID for the service principal"
  type        = string
  sensitive   = true
}

variable "azure_client_id" {
  description = "Service principal application (client) ID"
  type        = string
  sensitive   = true
}

variable "azure_client_secret" {
  description = "Service principal client secret"
  type        = string
  sensitive   = true
}
