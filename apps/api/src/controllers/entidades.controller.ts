import { Request, Response } from 'express';
import { db } from '../config/database';
import { logger } from '../config/logger';

export async function listEntidades(req: Request, res: Response): Promise<void> {
  try {
    const { page = '1', limit = '50', search = '', municipioId = '' } = req.query as Record<string, string>;
    const pg = Math.max(1, parseInt(page));
    const lim = Math.min(200, parseInt(limit));
    const offset = (pg - 1) * lim;

    const query = db('dim_entidade as e')
      .leftJoin('dim_municipio as m', 'e.fk_municipio', 'm.id')
      .select('e.id', 'e.nome', 'e.cnpj', 'e.tipo', 'e.ativo', 'e.fk_municipio', 'm.nome as municipio_nome', 'e.criado_em');

    if (search) query.where(function () {
      this.where('e.nome', 'like', `%${search}%`).orWhere('e.cnpj', 'like', `%${search}%`);
    });
    if (municipioId) query.where('e.fk_municipio', municipioId);

    const [rows, [{ total }]] = await Promise.all([
      query.clone().orderBy('e.nome').limit(lim).offset(offset),
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
    const { nome, cnpj, tipo = 'FUNDO', ativo = true, fk_municipio } = req.body;
    if (!nome) { res.status(400).json({ error: 'Nome é obrigatório' }); return; }

    const [id] = await db('dim_entidade').insert({
      nome, cnpj: cnpj || null, tipo, ativo,
      fk_municipio: fk_municipio || null,
    });
    res.status(201).json({ id, nome, cnpj, tipo, ativo, fk_municipio: fk_municipio || null });
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

    const { nome, cnpj, tipo, ativo, fk_municipio } = req.body;
    await db('dim_entidade').where('id', id).update({
      ...(nome !== undefined && { nome }),
      ...(cnpj !== undefined && { cnpj: cnpj || null }),
      ...(tipo !== undefined && { tipo }),
      ...(ativo !== undefined && { ativo }),
      ...(fk_municipio !== undefined && { fk_municipio: fk_municipio || null }),
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

export async function getEntidade(req: Request, res: Response): Promise<void> {
  try {
    const row = await db('dim_entidade').where('id', req.params.id).first();
    if (!row) { res.status(404).json({ error: 'Entidade não encontrada' }); return; }
    res.json(row);
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? 'Erro ao buscar entidade' });
  }
}

// Lista simples para dropdowns
export async function listEntidadesSimples(req: Request, res: Response): Promise<void> {
  try {
    const { municipioId = '' } = req.query as Record<string, string>;
    const query = db('dim_entidade').where('ativo', true).select('id', 'nome', 'tipo', 'fk_municipio').orderBy('nome');
    if (municipioId) query.where('fk_municipio', municipioId);
    const rows = await query;
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? 'Erro ao listar entidades' });
  }
}
