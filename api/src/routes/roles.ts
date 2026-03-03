import { Router } from 'express';
import { getAuthorizationClient } from '../services/azureClient';

export const rolesRouter = Router();

// GET /api/roles?subscriptionId=xxx
// Returns all role definitions visible at the subscription scope
rolesRouter.get('/', async (req, res) => {
  const { subscriptionId } = req.query;

  if (!subscriptionId || typeof subscriptionId !== 'string') {
    return res.status(400).json({ error: 'subscriptionId query param is required' });
  }

  const client = getAuthorizationClient(subscriptionId);
  const scope = `/subscriptions/${subscriptionId}`;
  const roles: unknown[] = [];

  for await (const role of client.roleDefinitions.list(scope)) {
    roles.push({
      id: role.id,
      name: role.name,
      roleName: role.roleName,
      description: role.description,
      type: role.roleType, // "BuiltInRole" | "CustomRole"
    });
  }

  res.json(roles);
});
