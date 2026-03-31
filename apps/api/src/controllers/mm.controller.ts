import { Request, Response } from 'express';
import { executarMM, aplicarSugestoesMM } from '../services/mmService';
import { logger } from '../config/logger';

/**
 * GET /api/mm/sugestoes
 * Executa o MM e retorna sugestões de classificação para credores sem grupo
 */
export async function getSugestoesMM(_req: Request, res: Response): Promise<void> {
  try {
    const resultado = await executarMM();
    res.json(resultado);
  } catch (err: any) {
    logger.error({ err: err?.message }, 'getSugestoesMM failed');
    res.status(500).json({ error: err?.message ?? 'Erro ao executar MM' });
  }
}

/**
 * POST /api/mm/aplicar
 * Aplica as sugestões confirmadas pelo usuário
 * Body: { confirmados: [{ credor_id, grupo_id, subgrupo_id }] }
 */
export async function aplicarMM(req: Request, res: Response): Promise<void> {
  try {
    const { confirmados } = req.body;

    if (!Array.isArray(confirmados) || confirmados.length === 0) {
      res.status(400).json({ error: 'Nenhum item para aplicar' });
      return;
    }

    const resultado = await aplicarSugestoesMM(confirmados);
    res.json(resultado);
  } catch (err: any) {
    logger.error({ err: err?.message }, 'aplicarMM failed');
    res.status(500).json({ error: err?.message ?? 'Erro ao aplicar sugestões MM' });
  }
}
