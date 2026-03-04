import axios from 'axios';
import type {
  Subscription,
  ResourceGroup,
  AzureResource,
  AzureUser,
  RoleDefinition,
  RoleAssignment,
  AuditLogEntry,
} from '../types';

const api = axios.create({ baseURL: '/api' });

// Subscriptions & resources
export const getSubscriptions = () =>
  api.get<Subscription[]>('/subscriptions').then((r) => r.data);

export const getResourceGroups = (subId: string) =>
  api.get<ResourceGroup[]>(`/subscriptions/${subId}/resource-groups`).then((r) => r.data);

export const getResources = (subId: string, rgName: string) =>
  api
    .get<AzureResource[]>(`/subscriptions/${subId}/resource-groups/${rgName}/resources`)
    .then((r) => r.data);

// Users (Azure AD via Graph API)
export const getUsers = (search?: string) =>
  api.get<AzureUser[]>('/users', { params: { search } }).then((r) => r.data);

// Role definitions
export const getRoles = (subscriptionId: string) =>
  api.get<RoleDefinition[]>('/roles', { params: { subscriptionId } }).then((r) => r.data);

// Role assignments
export const getAssignments = (subscriptionId: string, scope?: string, principalId?: string) =>
  api
    .get<RoleAssignment[]>('/assignments', { params: { subscriptionId, scope, principalId } })
    .then((r) => r.data);

export const createAssignment = (data: {
  subscriptionId: string;
  principalId: string;
  roleDefinitionId: string;
  scope: string;
  principalType?: 'User' | 'Group' | 'ServicePrincipal';
}) => api.post<RoleAssignment>('/assignments', data).then((r) => r.data);

export const deleteAssignment = (assignmentName: string, subscriptionId: string, scope: string) =>
  api
    .delete(`/assignments/${assignmentName}`, { params: { subscriptionId, scope } })
    .then((r) => r.data);

// Audit log
export const getAuditLog = (limit = 50, offset = 0) =>
  api
    .get<{ data: AuditLogEntry[]; total: number }>('/audit', { params: { limit, offset } })
    .then((r) => r.data);
