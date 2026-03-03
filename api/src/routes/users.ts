import { Router } from 'express';
import { graphClient } from '../services/graphClient';

export const usersRouter = Router();

// GET /api/users?search=alice
// Requires Microsoft Graph permission: User.Read.All
usersRouter.get('/', async (req, res) => {
  const { search } = req.query;

  const select = '$select=id,displayName,userPrincipalName,jobTitle,department';
  const top = '$top=100';
  let filter = '';

  if (search && typeof search === 'string') {
    // OData startswith filter — single-quotes must be escaped as ''
    const safe = search.replace(/'/g, "''");
    filter = `&$filter=startsWith(displayName,'${safe}') or startsWith(userPrincipalName,'${safe}')`;
  }

  const result = await graphClient.api(`/users?${select}&${top}${filter}`).get();

  res.json(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    result.value.map((u: any) => ({
      id: u.id,
      displayName: u.displayName,
      userPrincipalName: u.userPrincipalName,
      jobTitle: u.jobTitle ?? null,
      department: u.department ?? null,
    })),
  );
});
