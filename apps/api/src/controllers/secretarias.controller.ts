import { Request, Response } from 'express';
import { db } from '../config/database';
import { logger } from '../config/logger';

export async function listSecretarias(req: Request, res: Response): Promise<void> {
  try {
    const { page = '1', limit = '50', search = '', entidadeId } = req.query as Record<string, string>;
    const pg = Math.max(1, parseInt(page));
    const lim = Math.min(200, parseInt(limit));
    const offset = (pg - 1) * lim;

    const query = db('dim_secretaria as s')
      .leftJoin('dim_entidade as e', 's.fk_entidade', 'e.id')
      .select('s.id', 's.nome', 's.sigla', 's.fk_entidade', 's.ativo', 's.criado_em', 'e.nome as entidade_nome');

    if (search) query.where('s.nome', 'like', `%${search}%`);
    if (entidadeId) query.where('s.fk_entidade', entidadeId);

    const [rows, [{ total }]] = await Promise.all([
      query.clone().orderBy('s.nome').limit(lim).offset(offset),
      db('dim_secretaria').count('id as total'),
    ]);

    res.json({ rows, total: Number(total), page: pg, limit: lim });
  } catch (err: any) {
    logger.error({ err: err?.message }, 'listSecretarias failed');
    res.status(500).json({ error: err?.message ?? 'Erro ao listar secretarias' });
  }
}

export async function createSecretaria(req: Request, res: Response): Promise<void> {
  try {
    const { nome, sigla, fk_entidade, ativo = true } = req.body;
    if (!nome || !fk_entidade) {
      res.status(400).json({ error: 'Nome e entidade são obrigatórios' });
      return;
    }
    const entidade = await db('dim_entidade').where('id', fk_entidade).first();
    if (!entidade) { res.status(400).json({ error: 'Entidade não encontrada' }); return; }

    const [id] = await db('dim_secretaria').insert({ nome, sigla: sigla || null, fk_entidade, ativo });
    res.status(201).json({ id, nome, sigla, fk_entidade, ativo });
  } catch (err: any) {
    logger.error({ err: err?.message }, 'createSecretaria failed');
    res.status(500).json({ error: err?.message ?? 'Erro ao criar secretaria' });
  }
}

export async function updateSecretaria(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const row = await db('dim_secretaria').where('id', id).first();
    if (!row) { res.status(404).json({ error: 'Secretaria não encontrada' }); return; }

    const { nome, sigla, fk_entidade, ativo } = req.body;
    if (fk_entidade) {
      const entidade = await db('dim_entidade').where('id', fk_entidade).first();
      if (!entidade) { res.status(400).json({ error: 'Entidade não encontrada' }); return; }
    }

    await db('dim_secretaria').where('id', id).update({
      ...(nome !== undefined && { nome }),
      ...(sigla !== undefined && { sigla: sigla || null }),
      ...(fk_entidade !== undefined && { fk_entidade }),
      ...(ativo !== undefined && { ativo }),
    });
    res.json({ message: 'Secretaria atualizada com sucesso' });
  } catch (err: any) {
    logger.error({ err: err?.message }, 'updateSecretaria failed');
    res.status(500).json({ error: err?.message ?? 'Erro ao atualizar secretaria' });
  }
}

export async function deleteSecretaria(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const row = await db('dim_secretaria').where('id', id).first();
    if (!row) { res.status(404).json({ error: 'Secretaria não encontrada' }); return; }

    const setores = await db('dim_setor').where('fk_secretaria', id).count('id as total').first();
    if (Number(setores?.total) > 0) {
      res.status(400).json({ error: 'Não é possível excluir: existem setores vinculados a esta secretaria' });
      return;
    }

    await db('dim_secretaria').where('id', id).delete();
    res.json({ message: 'Secretaria excluída com sucesso' });
  } catch (err: any) {
    logger.error({ err: err?.message }, 'deleteSecretaria failed');
    res.status(500).json({ error: err?.message ?? 'Erro ao excluir secretaria' });
  }
}

export async function listSecretariasParaSetor(_req: Request, res: Response): Promise<void> {
  try {
    const rows = await db('dim_secretaria').where({ ativo: true }).select('id', 'nome', 'sigla').orderBy('nome');
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? 'Erro ao listar secretarias' });
  }
}

export async function listEntidadesParaSecretaria(_req: Request, res: Response): Promise<void> {
  try {
    const rows = await db('dim_entidade').where({ ativo: true }).select('id', 'nome').orderBy('nome');
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? 'Erro ao listar entidades' });
  }
}
