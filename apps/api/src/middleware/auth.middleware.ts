import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export interface JwtPayload {
  sub: number;
  email: string;
  role: string;
  fk_municipio: number | null;
  fk_entidade: number | null;
  iat?: number;
  exp?: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token não fornecido' });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as unknown as JwtPayload;
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Acesso negado' });
      return;
    }
    next();
  };
}

/**
 * Retorna o filtro de tenant para uso nas queries Knex.
 * SUPER_ADMIN não tem filtro (vê tudo).
 * GESTOR filtra por município.
 * CONTADOR/AUDITOR/VIEWER filtra por entidade (se tiver) ou município.
 */
export function getTenantFilter(user: JwtPayload): { fk_municipio?: number; fk_entidade?: number } {
  if (user.role === 'SUPER_ADMIN') return {};
  if (user.fk_entidade) return { fk_entidade: user.fk_entidade };
  if (user.fk_municipio) return { fk_municipio: user.fk_municipio };
  return {};
}
