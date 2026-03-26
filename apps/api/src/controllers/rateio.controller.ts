import { Request, Response } from 'express';
import { db } from '../config/database';

export interface RateioItem {
  fk_grupo: number | null;
  fk_subgrupo: number | null;
  valor: number;
}

export async function listRateio(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  const pagamento = await db('fact_ordem_pagamento')
    .where({ id })
    .select('rateio_itens')
    .first();

  if (!pagamento) {
    res.status(404).json({ error: 'Pagamento não encontrado' });
    return;
  }

  const itens = pagamento.rateio_itens ? JSON.parse(String(pagamento.rateio_itens)) : [];
  res.json(itens);
}

export async function saveRateio(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { itens } = req.body as { itens: RateioItem[] };

  if (!Array.isArray(itens)) {
    res.status(400).json({ error: 'itens deve ser um array' });
    return;
  }

  // Buscar pagamento
  const pagamento = await db('fact_ordem_pagamento')
    .where({ id })
    .select('valor_bruto', 'fk_credor', 'num_empenho_base', 'fk_setor_pag')
    .first();

  if (!pagamento) {
    res.status(404).json({ error: 'Pagamento não encontrado' });
    return;
  }

  // Filtrar apenas itens com valor preenchido
  const itensComValor = itens.filter((item) => Number(item.valor) > 0);

  // Validar soma apenas se houver itens com valor
  if (itensComValor.length > 0) {
    const soma = itensComValor.reduce((acc, item) => acc + Number(item.valor), 0);
    const diff = Math.abs(soma - Number(pagamento.valor_bruto));
    if (diff > 0.01) {
      res.status(422).json({
        error: `Soma dos itens (${soma.toFixed(2)}) deve ser igual ao valor bruto (${Number(pagamento.valor_bruto).toFixed(2)})`,
      });
      return;
    }
  }

  // Salvar JSON com apenas itens com valor
  await db('fact_ordem_pagamento')
    .where({ id })
    .update({
      rateio_itens: itensComValor.length > 0 ? JSON.stringify(itensComValor) : null,
    });

  // Atualizar template: gravar TODOS os grupos/subgrupos enviados (mesmo sem valor)
  // para que apareçam como sugestão na próxima vez
  if (pagamento.fk_credor && pagamento.num_empenho_base) {
    for (let i = 0; i < itens.length; i++) {
      const item = itens[i];
      const fkGrupo = item.fk_grupo || null;
      const fkSubgrupo = item.fk_subgrupo || null;
      const fkSetor = pagamento.fk_setor_pag || null;

      // Ignorar itens completamente vazios
      if (!fkGrupo && !fkSubgrupo) continue;

      // Upsert no template
      await db('dim_rateio_template')
        .insert({
          fk_credor: pagamento.fk_credor,
          num_empenho_base: pagamento.num_empenho_base,
          fk_setor: fkSetor,
          fk_grupo: fkGrupo,
          fk_subgrupo: fkSubgrupo,
          ordem: i,
        })
        .onConflict(['fk_credor', 'num_empenho_base', 'fk_setor', 'fk_grupo', 'fk_subgrupo'])
        .merge({ ordem: i });
    }
  }

  res.json(itensComValor);
}

// Retorna o template de grupos/subgrupos para um credor+empenho+setor
export async function getTemplate(req: Request, res: Response): Promise<void> {
  const { credorId, empenhoBase, setorId } = req.query as Record<string, string>;

  if (!credorId || !empenhoBase) {
    res.json([]);
    return;
  }

  const rows = await db('dim_rateio_template as rt')
    .leftJoin('dim_grupo_despesa as g', 'rt.fk_grupo', 'g.id')
    .leftJoin('dim_subgrupo_despesa as s', 'rt.fk_subgrupo', 's.id')
    .where('rt.fk_credor', credorId)
    .where('rt.num_empenho_base', empenhoBase)
    .where('rt.fk_setor', setorId || null)
    .orderBy('rt.ordem')
    .select(
      'rt.fk_grupo',
      'rt.fk_subgrupo',
      'g.nome as grupo_nome',
      's.nome as subgrupo_nome',
    );

  res.json(rows);
}
