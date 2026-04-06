import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { isSuperAdmin } from '../config/roles';

export interface JwtPayload {
  sub: number;
  email: string;
  role: string;
  fk_municipio: number | null;
  fk_entidade: number | null;
  permissoes: string[];
  entidades_ids: number[];
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
    if (!req.user) {
      res.status(403).json({ error: 'Acesso negado' });
      return;
    }
    // ADMIN e SUPER_ADMIN são equivalentes
    const effectiveRoles = roles.flatMap(r => r === 'SUPER_ADMIN' ? ['SUPER_ADMIN', 'ADMIN'] : [r]);
    if (!effectiveRoles.includes(req.user.role)) {
      res.status(403).json({ error: 'Acesso negado' });
      return;
    }
    next();
  };
}

/**
 * Retorna o filtro de tenant para uso nas queries Knex.
 * SUPER_ADMIN/ADMIN não têm filtro (veem tudo).
 * GESTOR filtra por município.
 * CONTADOR/AUDITOR/VIEWER filtra por entidades_ids (múltiplas) ou fk_entidade (legado) ou município.
 */
export function getTenantFilter(user: JwtPayload): {
  fk_municipio?: number;
  fk_entidade?: number;
  entidades_ids?: number[];
} {
  if (isSuperAdmin(user.role)) return {};
  if (user.role === 'GESTOR') {
    if (user.fk_municipio) return { fk_municipio: user.fk_municipio };
    return {};
  }
  // CONTADOR / AUDITOR / VIEWER — prioriza lista de entidades
  const ids = user.entidades_ids ?? [];
  if (ids.length > 0) return { entidades_ids: ids };
  if (user.fk_entidade) return { fk_entidade: user.fk_entidade };
  if (user.fk_municipio) return { fk_municipio: user.fk_municipio };
  return {};
}

/**
 * Aplica o filtro de tenant numa query Knex.
 * @param q    Query builder
 * @param tf   Resultado de getTenantFilter()
 * @param col  Coluna de entidade (padrão: 'fk_entidade')
 * @param munCol Coluna de município (padrão: 'fk_municipio')
 */
export function applyTenantFilter(
  q: any,
  tf: ReturnType<typeof getTenantFilter>,
  col = 'fk_entidade',
  munCol = 'fk_municipio',
): void {
  if (tf.entidades_ids && tf.entidades_ids.length > 0) {
    q.whereIn(col, tf.entidades_ids);
  } else if (tf.fk_entidade) {
    q.where(col, tf.fk_entidade);
  } else if (tf.fk_municipio) {
    q.where(munCol, tf.fk_municipio);
  }
}
