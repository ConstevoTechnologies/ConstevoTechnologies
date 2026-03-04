import { ClientSecretCredential, DefaultAzureCredential } from '@azure/identity';
import { AuthorizationManagementClient } from '@azure/arm-authorization';
import { ResourceManagementClient } from '@azure/arm-resources';
import { SubscriptionClient } from '@azure/arm-subscriptions';

function buildCredential() {
  const { AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET } = process.env;
  if (AZURE_TENANT_ID && AZURE_CLIENT_ID && AZURE_CLIENT_SECRET) {
    return new ClientSecretCredential(AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET);
  }
  // Fallback: managed identity / az login in local dev
  return new DefaultAzureCredential();
}

export const credential = buildCredential();

export const getAuthorizationClient = (subscriptionId: string) =>
  new AuthorizationManagementClient(credential, subscriptionId);

export const getResourceClient = (subscriptionId: string) =>
  new ResourceManagementClient(credential, subscriptionId);

export const getSubscriptionClient = () =>
  new SubscriptionClient(credential);
