import { Router } from 'express';
import { prisma } from '../services/prisma';

export const auditRouter = Router();

// GET /api/audit?limit=50&offset=0
auditRouter.get('/', async (req, res) => {
  const limit = Math.min(parseInt((req.query.limit as string) ?? '50', 10), 200);
  const offset = parseInt((req.query.offset as string) ?? '0', 10);

  const [data, total] = await Promise.all([
    prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.auditLog.count(),
  ]);

  res.json({ data, total });
});
