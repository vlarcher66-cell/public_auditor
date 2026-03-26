import { Request, Response } from 'express';
import { db } from '../config/database';
import { logger } from '../config/logger';

export async function listSetores(req: Request, res: Response): Promise<void> {
  try {
    const { page = '1', limit = '50', search = '' } = req.query as Record<string, string>;
    const pg = Math.max(1, parseInt(page));
    const lim = Math.min(200, parseInt(limit));
    const offset = (pg - 1) * lim;

    const query = db('dim_setor as s')
      .leftJoin('dim_bloco as b', 's.fk_bloco', 'b.id')
      .leftJoin('dim_secretaria as sec', 's.fk_secretaria', 'sec.id')
      .select('s.id', 's.descricao', 's.fk_bloco', 's.fk_secretaria', 's.palavras_chave', 's.num_empenhos', 'b.id as bloco_id', 'b.descricao as bloco_descricao', 'sec.id as secretaria_id', 'sec.nome as secretaria_nome');

    if (search) {
      query.where((q) =>
        q.where('s.descricao', 'like', `%${search}%`)
          .orWhere('b.descricao', 'like', `%${search}%`),
      );
    }

    const [rows, [{ total }]] = await Promise.all([
      query.orderBy('s.id', 'asc').limit(lim).offset(offset),
      db('dim_setor').count('id as total'),
    ]);

    res.json({ rows, total: Number(total), page: pg, limit: lim });
  } catch (err: any) {
    logger.error({ err: err?.message }, 'listSetores failed');
    res.status(500).json({ error: err?.message ?? 'Erro ao listar setores' });
  }
}

export async function createSetor(req: Request, res: Response): Promise<void> {
  try {
    const { descricao, fk_bloco } = req.body;
    if (!descricao || !fk_bloco) {
      res.status(400).json({ error: 'Descrição e bloco são obrigatórios' });
      return;
    }
    const blocoExists = await db('dim_bloco').where('id', fk_bloco).first();
    if (!blocoExists) { res.status(400).json({ error: 'Bloco não encontrado' }); return; }

    const { palavras_chave, fk_secretaria } = req.body;
    const [id] = await db('dim_setor').insert({ descricao, fk_bloco, palavras_chave: palavras_chave || null, fk_secretaria: fk_secretaria || null });
    res.status(201).json({ id, descricao, fk_bloco, palavras_chave, message: 'Setor criado com sucesso' });
  } catch (err: any) {
    logger.error({ err: err?.message }, 'createSetor failed');
    res.status(500).json({ error: err?.message ?? 'Erro ao criar setor' });
  }
}

export async function updateSetor(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { descricao, fk_bloco } = req.body;

    const setor = await db('dim_setor').where('id', id).first();
    if (!setor) { res.status(404).json({ error: 'Setor não encontrado' }); return; }

    if (fk_bloco) {
      const blocoExists = await db('dim_bloco').where('id', fk_bloco).first();
      if (!blocoExists) { res.status(400).json({ error: 'Bloco não encontrado' }); return; }
    }

    const { palavras_chave, fk_secretaria, num_empenhos } = req.body;
    await db('dim_setor').where('id', id).update({
      ...(descricao && { descricao }),
      ...(fk_bloco && { fk_bloco }),
      ...('palavras_chave' in req.body && { palavras_chave: palavras_chave || null }),
      ...('fk_secretaria' in req.body && { fk_secretaria: fk_secretaria || null }),
      ...('num_empenhos' in req.body && { num_empenhos: num_empenhos || null }),
    });
    res.json({ message: 'Setor atualizado com sucesso' });
  } catch (err: any) {
    logger.error({ err: err?.message }, 'updateSetor failed');
    res.status(500).json({ error: err?.message ?? 'Erro ao atualizar setor' });
  }
}

export async function deleteSetor(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const setor = await db('dim_setor').where('id', id).first();
    if (!setor) { res.status(404).json({ error: 'Setor não encontrado' }); return; }

    await db('dim_setor').where('id', id).delete();
    res.json({ message: 'Setor excluído com sucesso' });
  } catch (err: any) {
    logger.error({ err: err?.message }, 'deleteSetor failed');
    res.status(500).json({ error: err?.message ?? 'Erro ao excluir setor' });
  }
}

export async function listBlocosParaSetor(req: Request, res: Response): Promise<void> {
  try {
    const blocos = await db('dim_bloco').select('id', 'descricao').orderBy('id', 'asc');
    res.json(blocos);
  } catch (err: any) {
    logger.error({ err: err?.message }, 'listBlocosParaSetor failed');
    res.status(500).json({ error: err?.message ?? 'Erro ao listar blocos' });
  }
}
