export interface Subscription {
  id: string;
  displayName: string;
  state: string;
}

export interface ResourceGroup {
  id: string;
  name: string;
  location: string;
  tags: Record<string, string>;
}

export interface AzureResource {
  id: string;
  name: string;
  type: string;
  location: string;
}

export interface AzureUser {
  id: string;
  displayName: string;
  userPrincipalName: string;
  jobTitle: string | null;
  department: string | null;
}

export interface RoleDefinition {
  id: string;
  name: string;
  roleName: string;
  description: string;
  type: string;
}

export interface RoleAssignment {
  id: string;
  name: string;
  principalId: string;
  principalType: string;
  roleDefinitionId: string;
  scope: string;
}

export interface AuditLogEntry {
  id: string;
  action: 'ASSIGN' | 'REVOKE';
  principalId: string;
  roleDefinitionId: string;
  scope: string;
  assignmentId: string;
  performedBy: string;
  createdAt: string;
}
