import { Request, Response } from 'express';
import { db } from '../config/database';
import { logger } from '../config/logger';

export async function listMunicipios(req: Request, res: Response): Promise<void> {
  try {
    const { page = '1', limit = '50', search = '' } = req.query as Record<string, string>;
    const pg = Math.max(1, parseInt(page));
    const lim = Math.min(200, parseInt(limit));
    const offset = (pg - 1) * lim;

    const query = db('dim_municipio');
    if (search) query.where('nome', 'like', `%${search}%`);

    const [rows, [{ total }]] = await Promise.all([
      query.clone().select('*').orderBy('nome').limit(lim).offset(offset),
      query.clone().count('id as total'),
    ]);

    res.json({ rows, total: Number(total), page: pg, limit: lim });
  } catch (err: any) {
    logger.error({ err: err?.message }, 'listMunicipios failed');
    res.status(500).json({ error: err?.message ?? 'Erro ao listar municípios' });
  }
}

export async function getMunicipio(req: Request, res: Response): Promise<void> {
  try {
    const municipio = await db('dim_municipio').where('id', req.params.id).first();
    if (!municipio) { res.status(404).json({ error: 'Município não encontrado' }); return; }
    res.json(municipio);
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? 'Erro ao buscar município' });
  }
}

export async function createMunicipio(req: Request, res: Response): Promise<void> {
  try {
    const { nome, cnpj, uf, ativo = true } = req.body;
    if (!nome) { res.status(400).json({ error: 'Nome é obrigatório' }); return; }

    const [{ id }] = await db('dim_municipio').insert({ nome, cnpj: cnpj || null, uf: uf || null, ativo }).returning('id');
    logger.info({ id, nome }, 'Município criado');
    res.status(201).json({ id, nome, cnpj, uf, ativo, message: 'Município criado com sucesso' });
  } catch (err: any) {
    logger.error({ err: err?.message }, 'createMunicipio failed');
    res.status(500).json({ error: err?.message ?? 'Erro ao criar município' });
  }
}

export async function updateMunicipio(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const municipio = await db('dim_municipio').where('id', id).first();
    if (!municipio) { res.status(404).json({ error: 'Município não encontrado' }); return; }

    const { nome, cnpj, uf, ativo } = req.body;
    await db('dim_municipio').where('id', id).update({
      ...(nome !== undefined && { nome }),
      ...(cnpj !== undefined && { cnpj: cnpj || null }),
      ...(uf !== undefined && { uf: uf || null }),
      ...(ativo !== undefined && { ativo }),
    });
    res.json({ message: 'Município atualizado com sucesso' });
  } catch (err: any) {
    logger.error({ err: err?.message }, 'updateMunicipio failed');
    res.status(500).json({ error: err?.message ?? 'Erro ao atualizar município' });
  }
}

export async function deleteMunicipio(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const municipio = await db('dim_municipio').where('id', id).first();
    if (!municipio) { res.status(404).json({ error: 'Município não encontrado' }); return; }

    const usuariosVinculados = await db('usuarios').where('fk_municipio', id).count('id as total').first();
    if (Number(usuariosVinculados?.total) > 0) {
      res.status(400).json({ error: 'Município possui usuários vinculados. Remova-os primeiro.' });
      return;
    }

    await db('dim_municipio').where('id', id).delete();
    res.json({ message: 'Município excluído com sucesso' });
  } catch (err: any) {
    logger.error({ err: err?.message }, 'deleteMunicipio failed');
    res.status(500).json({ error: err?.message ?? 'Erro ao excluir município' });
  }
}

// Lista simples para dropdowns
export async function listMunicipiosSimples(req: Request, res: Response): Promise<void> {
  try {
    const rows = await db('dim_municipio').where('ativo', true).select('id', 'nome', 'uf').orderBy('nome');
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? 'Erro ao listar municípios' });
  }
}
