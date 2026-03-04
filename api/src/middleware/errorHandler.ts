import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

interface AzureError extends Error {
  statusCode?: number;
  code?: string;
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: 'Validation error', details: err.flatten() });
  }

  if (err instanceof Error) {
    const azureErr = err as AzureError;
    if (azureErr.statusCode) {
      return res.status(azureErr.statusCode).json({
        error: azureErr.message,
        code: azureErr.code,
      });
    }
    console.error(err);
    return res.status(500).json({ error: err.message });
  }

  console.error('Unknown error:', err);
  res.status(500).json({ error: 'Internal server error' });
}
