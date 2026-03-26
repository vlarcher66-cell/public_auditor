import { Request, Response } from 'express';
import { db } from '../config/database';

export async function listarRegras(req: Request, res: Response): Promise<void> {
  const { fk_credor } = req.query;
  const query = db('dim_regra_empenho as r')
    .select('r.*', 'g.nome as grupo_nome', 's.nome as subgrupo_nome')
    .leftJoin('dim_grupo_despesa as g', 'r.fk_grupo', 'g.id')
    .leftJoin('dim_subgrupo_despesa as s', 'r.fk_subgrupo', 's.id')
    .orderBy('r.num_empenho_base');
  if (fk_credor) query.where('r.fk_credor', Number(fk_credor));
  const rows = await query;
  res.json(rows);
}

export async function salvarRegra(req: Request, res: Response): Promise<void> {
  const { num_empenho_base, fk_credor, fk_grupo, fk_subgrupo, fk_pagamento } = req.body;
  if (!num_empenho_base) {
    res.status(400).json({ error: 'num_empenho_base é obrigatório' });
    return;
  }

  // Busca o fk_credor real direto da fact_ordem_pagamento se disponível
  let credorReal = fk_credor;
  if (fk_pagamento) {
    const pag = await db('fact_ordem_pagamento').select('fk_credor').where({ id: fk_pagamento }).first();
    if (pag?.fk_credor) credorReal = pag.fk_credor;
  }

  if (!credorReal) {
    res.status(400).json({ error: 'fk_credor é obrigatório' });
    return;
  }

  await db('dim_regra_empenho')
    .insert({ num_empenho_base, fk_credor: credorReal, fk_grupo: fk_grupo || null, fk_subgrupo: fk_subgrupo || null })
    .onConflict(['num_empenho_base', 'fk_credor'])
    .merge({ fk_grupo: fk_grupo || null, fk_subgrupo: fk_subgrupo || null });

  // Aplica a regra nos pagamentos existentes que ainda não foram classificados manualmente
  await db('fact_ordem_pagamento')
    .where({ fk_credor: credorReal, num_empenho_base })
    .whereNull('fk_grupo_pag')
    .update({ fk_grupo_pag: fk_grupo || null, fk_subgrupo_pag: fk_subgrupo || null });

  res.json({ ok: true });
}

export async function deletarRegra(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  // Busca a regra antes de deletar para saber quais pagamentos reverter
  const regra = await db('dim_regra_empenho').where({ id }).first();
  if (regra) {
    // Reverte pagamentos que foram classificados por esta regra (não os classificados manualmente com outro valor)
    await db('fact_ordem_pagamento')
      .where({ fk_credor: regra.fk_credor, num_empenho_base: regra.num_empenho_base })
      .where({ fk_grupo_pag: regra.fk_grupo, fk_subgrupo_pag: regra.fk_subgrupo })
      .update({ fk_grupo_pag: null, fk_subgrupo_pag: null });
    await db('dim_regra_empenho').where({ id }).delete();
  }
  res.json({ ok: true });
}
