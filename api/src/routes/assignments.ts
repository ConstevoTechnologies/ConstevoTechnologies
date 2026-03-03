import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { getAuthorizationClient } from '../services/azureClient';
import { prisma } from '../services/prisma';

export const assignmentsRouter = Router();

// GET /api/assignments?subscriptionId=xxx&scope=...&principalId=...
assignmentsRouter.get('/', async (req, res) => {
  const { subscriptionId, scope, principalId } = req.query;

  if (!subscriptionId || typeof subscriptionId !== 'string') {
    return res.status(400).json({ error: 'subscriptionId query param is required' });
  }

  const client = getAuthorizationClient(subscriptionId);
  const listScope = (scope as string) ?? `/subscriptions/${subscriptionId}`;
  const filter = principalId ? `principalId eq '${principalId}'` : undefined;

  const assignments: unknown[] = [];
  for await (const a of client.roleAssignments.listForScope(listScope, { filter })) {
    assignments.push({
      id: a.id,
      name: a.name,
      principalId: a.principalId,
      principalType: a.principalType,
      roleDefinitionId: a.roleDefinitionId,
      scope: a.scope,
    });
  }

  res.json(assignments);
});

const PRINCIPAL_TYPES = ['User', 'Group', 'ServicePrincipal'] as const;
type PrincipalType = (typeof PRINCIPAL_TYPES)[number];

const createSchema = z.object({
  subscriptionId: z.string().uuid(),
  principalId: z.string().uuid(),
  roleDefinitionId: z.string().min(1),
  scope: z.string().min(1),
  // Allow assigning roles to users, groups, or service principals
  principalType: z.enum(PRINCIPAL_TYPES).default('User'),
  performedBy: z.string().optional(),
});

// POST /api/assignments
assignmentsRouter.post('/', async (req, res) => {
  const body = createSchema.parse(req.body);
  const client = getAuthorizationClient(body.subscriptionId);
  const assignmentName = uuidv4();

  const assignment = await client.roleAssignments.create(body.scope, assignmentName, {
    principalId: body.principalId,
    roleDefinitionId: body.roleDefinitionId,
    principalType: body.principalType as PrincipalType,
  });

  await prisma.auditLog.create({
    data: {
      action: 'ASSIGN',
      principalId: body.principalId,
      roleDefinitionId: body.roleDefinitionId,
      scope: body.scope,
      assignmentId: assignment.name!,
      performedBy: body.performedBy ?? 'system',
    },
  });

  res.status(201).json({
    id: assignment.id,
    name: assignment.name,
    principalId: assignment.principalId,
    roleDefinitionId: assignment.roleDefinitionId,
    scope: assignment.scope,
  });
});

// DELETE /api/assignments/:assignmentName?subscriptionId=xxx&scope=...
assignmentsRouter.delete('/:assignmentName', async (req, res) => {
  const { assignmentName } = req.params;
  const { subscriptionId, scope } = req.query;

  if (!subscriptionId || typeof subscriptionId !== 'string') {
    return res.status(400).json({ error: 'subscriptionId query param is required' });
  }
  if (!scope || typeof scope !== 'string') {
    return res.status(400).json({ error: 'scope query param is required' });
  }

  const client = getAuthorizationClient(subscriptionId);
  const deleted = await client.roleAssignments.delete(scope, assignmentName);

  await prisma.auditLog.create({
    data: {
      action: 'REVOKE',
      principalId: deleted.principalId ?? '',
      roleDefinitionId: deleted.roleDefinitionId ?? '',
      scope,
      assignmentId: assignmentName,
      performedBy: 'system',
    },
  });

  res.json({ message: 'Role assignment removed', name: assignmentName });
});
