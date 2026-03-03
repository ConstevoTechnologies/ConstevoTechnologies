import { Router } from 'express';
import { getSubscriptionClient, getResourceClient } from '../services/azureClient';

export const subscriptionsRouter = Router();

// GET /api/subscriptions
subscriptionsRouter.get('/', async (_req, res) => {
  const client = getSubscriptionClient();
  const subs: unknown[] = [];

  for await (const sub of client.subscriptions.list()) {
    subs.push({
      id: sub.subscriptionId,
      displayName: sub.displayName,
      state: sub.state,
    });
  }

  res.json(subs);
});

// GET /api/subscriptions/:subId/resource-groups
subscriptionsRouter.get('/:subId/resource-groups', async (req, res) => {
  const { subId } = req.params;
  const client = getResourceClient(subId);
  const groups: unknown[] = [];

  for await (const rg of client.resourceGroups.list()) {
    groups.push({
      id: rg.id,
      name: rg.name,
      location: rg.location,
      tags: rg.tags ?? {},
    });
  }

  res.json(groups);
});

// GET /api/subscriptions/:subId/resource-groups/:rgName/resources
subscriptionsRouter.get('/:subId/resource-groups/:rgName/resources', async (req, res) => {
  const { subId, rgName } = req.params;
  const client = getResourceClient(subId);
  const resources: unknown[] = [];

  for await (const resource of client.resources.listByResourceGroup(rgName)) {
    resources.push({
      id: resource.id,
      name: resource.name,
      type: resource.type,
      location: resource.location,
    });
  }

  res.json(resources);
});
