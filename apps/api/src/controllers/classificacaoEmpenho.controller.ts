import { Request, Response } from 'express';
import { db } from '../config/database';

// Lista regras de um credor
export async function listRegras(req: Request, res: Response): Promise<void> {
  const { credorId } = req.params;
  const regras = await db('dim_classificacao_empenho as ce')
    .leftJoin('dim_grupo_despesa as g', 'ce.fk_grupo_pag', 'g.id')
    .leftJoin('dim_subgrupo_despesa as s', 'ce.fk_subgrupo_pag', 's.id')
    .where('ce.fk_credor', credorId)
    .select('ce.id', 'ce.num_empenho_base', 'ce.fk_grupo_pag', 'ce.fk_subgrupo_pag', 'g.nome as grupo_nome', 's.nome as subgrupo_nome')
    .orderBy('ce.num_empenho_base');
  res.json(regras);
}

// Salva ou atualiza regra (upsert por credor+empenho)
export async function saveRegra(req: Request, res: Response): Promise<void> {
  const { credorId } = req.params;
  const { num_empenho_base, fk_grupo_pag, fk_subgrupo_pag } = req.body;

  if (!num_empenho_base) {
    res.status(400).json({ error: 'num_empenho_base é obrigatório' });
    return;
  }

  // Verifica que o credor tem detalhar_no_pagamento = true
  const credor = await db('dim_credor').where('id', credorId).first();
  if (!credor) { res.status(404).json({ error: 'Credor não encontrado' }); return; }
  if (!credor.detalhar_no_pagamento) {
    res.status(400).json({ error: 'Credor não usa classificação por pagamento' });
    return;
  }

  const existing = await db('dim_classificacao_empenho')
    .where({ fk_credor: credorId, num_empenho_base })
    .first();

  if (existing) {
    await db('dim_classificacao_empenho')
      .where({ id: existing.id })
      .update({ fk_grupo_pag: fk_grupo_pag || null, fk_subgrupo_pag: fk_subgrupo_pag || null });
    res.json({ message: 'Regra atualizada' });
  } else {
    await db('dim_classificacao_empenho').insert({
      fk_credor: credorId,
      num_empenho_base,
      fk_grupo_pag: fk_grupo_pag || null,
      fk_subgrupo_pag: fk_subgrupo_pag || null,
    });
    res.status(201).json({ message: 'Regra criada' });
  }
}

// Remove regra
export async function deleteRegra(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  await db('dim_classificacao_empenho').where({ id }).delete();
  res.json({ message: 'Regra removida' });
}

// Busca regra específica por credor+empenho (usada no popup)
export async function getRegra(req: Request, res: Response): Promise<void> {
  const { credorId, empenhoBase } = req.params;
  const regra = await db('dim_classificacao_empenho as ce')
    .leftJoin('dim_grupo_despesa as g', 'ce.fk_grupo_pag', 'g.id')
    .leftJoin('dim_subgrupo_despesa as s', 'ce.fk_subgrupo_pag', 's.id')
    .where({ 'ce.fk_credor': credorId, 'ce.num_empenho_base': empenhoBase })
    .select('ce.id', 'ce.num_empenho_base', 'ce.fk_grupo_pag', 'ce.fk_subgrupo_pag', 'g.nome as grupo_nome', 's.nome as subgrupo_nome')
    .first();
  res.json(regra || null);
}
