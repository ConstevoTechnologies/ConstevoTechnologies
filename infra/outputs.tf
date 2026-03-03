output "api_url" {
  description = "Backend API base URL"
  value       = "https://${azurerm_linux_web_app.api.default_hostname}"
}

output "frontend_url" {
  description = "Frontend Static Web App URL"
  value       = "https://${azurerm_static_web_app.frontend.default_host_name}"
}

output "acr_login_server" {
  description = "Container Registry login server (used in CI/CD)"
  value       = azurerm_container_registry.main.login_server
}

output "postgres_fqdn" {
  description = "PostgreSQL server FQDN"
  value       = azurerm_postgresql_flexible_server.main.fqdn
  sensitive   = true
}

output "static_web_app_api_token" {
  description = "Deployment token for Azure Static Web Apps (add to GitHub secrets)"
  value       = azurerm_static_web_app.frontend.api_key
  sensitive   = true
}
