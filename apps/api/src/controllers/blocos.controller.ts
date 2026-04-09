import { Request, Response } from 'express';
import { db } from '../config/database';
import { logger } from '../config/logger';

export async function listBlocos(req: Request, res: Response): Promise<void> {
  try {
    const { page = '1', limit = '50', search = '' } = req.query as Record<string, string>;
    const pg = Math.max(1, parseInt(page));
    const lim = Math.min(200, parseInt(limit));
    const offset = (pg - 1) * lim;

    const query = db('dim_bloco').select('id', 'descricao');
    if (search) query.where('descricao', 'like', `%${search}%`);

    const [rows, [{ total }]] = await Promise.all([
      query.orderBy('id', 'asc').limit(lim).offset(offset),
      db('dim_bloco').count('id as total'),
    ]);

    res.json({ rows, total: Number(total), page: pg, limit: lim });
  } catch (err: any) {
    logger.error({ err: err?.message }, 'listBlocos failed');
    res.status(500).json({ error: err?.message ?? 'Erro ao listar blocos' });
  }
}

export async function createBloco(req: Request, res: Response): Promise<void> {
  try {
    const { descricao } = req.body;
    if (!descricao) {
      res.status(400).json({ error: 'Descrição é obrigatória' });
      return;
    }
    const [{ id }] = await db('dim_bloco').insert({ descricao }).returning('id');
    res.status(201).json({ id, descricao, message: 'Bloco criado com sucesso' });
  } catch (err: any) {
    logger.error({ err: err?.message }, 'createBloco failed');
    res.status(500).json({ error: err?.message ?? 'Erro ao criar bloco' });
  }
}

export async function updateBloco(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { descricao } = req.body;

    const bloco = await db('dim_bloco').where('id', id).first();
    if (!bloco) { res.status(404).json({ error: 'Bloco não encontrado' }); return; }
    if (!descricao) { res.status(400).json({ error: 'Descrição é obrigatória' }); return; }

    await db('dim_bloco').where('id', id).update({ descricao });
    res.json({ message: 'Bloco atualizado com sucesso' });
  } catch (err: any) {
    logger.error({ err: err?.message }, 'updateBloco failed');
    res.status(500).json({ error: err?.message ?? 'Erro ao atualizar bloco' });
  }
}

export async function deleteBloco(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const bloco = await db('dim_bloco').where('id', id).first();
    if (!bloco) { res.status(404).json({ error: 'Bloco não encontrado' }); return; }

    const vinculados = await db('dim_setor').where('fk_bloco', id).count('id as count').first();
    if (vinculados && Number(vinculados.count) > 0) {
      res.status(400).json({ error: `Este bloco possui ${vinculados.count} setor(es) vinculado(s)` });
      return;
    }

    await db('dim_bloco').where('id', id).delete();
    res.json({ message: 'Bloco excluído com sucesso' });
  } catch (err: any) {
    logger.error({ err: err?.message }, 'deleteBloco failed');
    res.status(500).json({ error: err?.message ?? 'Erro ao excluir bloco' });
  }
}
