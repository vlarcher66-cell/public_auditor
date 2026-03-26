import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';

export function errorMiddleware(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  logger.error({ err, path: req.path, method: req.method }, 'Unhandled error');
  res.status(500).json({ error: 'Erro interno do servidor' });
}
