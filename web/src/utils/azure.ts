/** Build an Azure scope string from subscription + optional resource group. */
export function buildScope(subscriptionId: string, resourceGroup?: string): string {
  if (resourceGroup) {
    return `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}`;
  }
  return `/subscriptions/${subscriptionId}`;
}

/** Extract the short role name from a full role definition ID path. */
export function extractRoleName(roleDefinitionId: string): string {
  return roleDefinitionId.split('/').at(-1) ?? roleDefinitionId;
}

/** Truncate a UUID/GUID for display, e.g. "a1b2c3d4…" */
export function shortId(id: string, length = 8): string {
  return id.length > length ? `${id.slice(0, length)}…` : id;
}
