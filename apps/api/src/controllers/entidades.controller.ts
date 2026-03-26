import { Request, Response } from 'express';
import { db } from '../config/database';
import { logger } from '../config/logger';

export async function listEntidades(req: Request, res: Response): Promise<void> {
  try {
    const { page = '1', limit = '50', search = '' } = req.query as Record<string, string>;
    const pg = Math.max(1, parseInt(page));
    const lim = Math.min(200, parseInt(limit));
    const offset = (pg - 1) * lim;

    const query = db('dim_entidade').select('id', 'nome', 'cnpj', 'tipo', 'ativo', 'criado_em');
    if (search) query.where('nome', 'like', `%${search}%`).orWhere('cnpj', 'like', `%${search}%`);

    const [rows, [{ total }]] = await Promise.all([
      query.clone().orderBy('nome').limit(lim).offset(offset),
      db('dim_entidade').count('id as total'),
    ]);

    res.json({ rows, total: Number(total), page: pg, limit: lim });
  } catch (err: any) {
    logger.error({ err: err?.message }, 'listEntidades failed');
    res.status(500).json({ error: err?.message ?? 'Erro ao listar entidades' });
  }
}

export async function createEntidade(req: Request, res: Response): Promise<void> {
  try {
    const { nome, cnpj, tipo = 'FUNDO', ativo = true } = req.body;
    if (!nome) { res.status(400).json({ error: 'Nome é obrigatório' }); return; }

    const [id] = await db('dim_entidade').insert({ nome, cnpj: cnpj || null, tipo, ativo });
    res.status(201).json({ id, nome, cnpj, tipo, ativo });
  } catch (err: any) {
    logger.error({ err: err?.message }, 'createEntidade failed');
    res.status(500).json({ error: err?.message ?? 'Erro ao criar entidade' });
  }
}

export async function updateEntidade(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const row = await db('dim_entidade').where('id', id).first();
    if (!row) { res.status(404).json({ error: 'Entidade não encontrada' }); return; }

    const { nome, cnpj, tipo, ativo } = req.body;
    await db('dim_entidade').where('id', id).update({
      ...(nome !== undefined && { nome }),
      ...(cnpj !== undefined && { cnpj: cnpj || null }),
      ...(tipo !== undefined && { tipo }),
      ...(ativo !== undefined && { ativo }),
    });
    res.json({ message: 'Entidade atualizada com sucesso' });
  } catch (err: any) {
    logger.error({ err: err?.message }, 'updateEntidade failed');
    res.status(500).json({ error: err?.message ?? 'Erro ao atualizar entidade' });
  }
}

export async function deleteEntidade(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const row = await db('dim_entidade').where('id', id).first();
    if (!row) { res.status(404).json({ error: 'Entidade não encontrada' }); return; }

    const secretarias = await db('dim_secretaria').where('fk_entidade', id).count('id as total').first();
    if (Number(secretarias?.total) > 0) {
      res.status(400).json({ error: 'Não é possível excluir: existem secretarias vinculadas a esta entidade' });
      return;
    }

    await db('dim_entidade').where('id', id).delete();
    res.json({ message: 'Entidade excluída com sucesso' });
  } catch (err: any) {
    logger.error({ err: err?.message }, 'deleteEntidade failed');
    res.status(500).json({ error: err?.message ?? 'Erro ao excluir entidade' });
  }
}
