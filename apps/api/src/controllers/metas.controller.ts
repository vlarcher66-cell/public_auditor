import { Request, Response } from 'express';
import { db } from '../config/database';

const DEA_GRUPOS = ['RESTOS A PAGAR', 'DESPESAS DO EXERCÍCIO ANTERIOR', 'DESPESAS DO EXERCICIO ANTERIOR'];

function applyRBAC(q: any, user: any) {
  if (user?.role !== 'SUPER_ADMIN' && user?.fk_municipio) {
    q.where('f.fk_municipio', user.fk_municipio);
  }
  return q;
}

// ── Despesa Real de um ano ──────────────────────────────────────────────────
// Regra:
//   Pago em ANO   onde grupo NÃO é DEA/RP → despesa própria do ANO
//   Pago em ANO+1 onde grupo É   DEA/RP   → RP de ANO pago no seguinte
// Agrupado por grupo + subgrupo + mes
export async function getDespesaReal(req: Request, res: Response): Promise<void> {
  const ano = parseInt(req.query.ano as string) || new Date().getFullYear() - 1;
  const user = (req as any).user;

  // Pagamentos do próprio ano (excluindo DEA/RP)
  const q1 = db('fact_ordem_pagamento as f')
    .join('dim_credor as c', 'f.fk_credor', 'c.id')
    .join('dim_grupo_despesa as g', 'c.fk_grupo', 'g.id')
    .leftJoin('dim_subgrupo_despesa as s', 'c.fk_subgrupo', 's.id')
    .whereRaw('YEAR(f.data_pagamento) = ?', [ano])
    .whereNotIn('g.nome', DEA_GRUPOS)
    .whereNotNull('f.data_pagamento')
    .select(
      'g.id as grupo_id',
      'g.nome as grupo_nome',
      db.raw('COALESCE(s.id, 0) as subgrupo_id'),
      db.raw("COALESCE(s.nome, 'Sem Subgrupo') as subgrupo_nome"),
      db.raw('MONTH(f.data_pagamento) as mes'),
    )
    .sum('f.valor_liquido as total')
    .groupBy('g.id', 'g.nome', 's.id', 's.nome', db.raw('MONTH(f.data_pagamento)'));

  // Pagamentos do ano seguinte que são DEA/RP (pertencem ao ANO)
  const q2 = db('fact_ordem_pagamento as f')
    .join('dim_credor as c', 'f.fk_credor', 'c.id')
    .join('dim_grupo_despesa as g', 'c.fk_grupo', 'g.id')
    .leftJoin('dim_subgrupo_despesa as s', 'c.fk_subgrupo', 's.id')
    .whereRaw('YEAR(f.data_pagamento) = ?', [ano + 1])
    .whereIn('g.nome', DEA_GRUPOS)
    .whereNotNull('f.data_pagamento')
    .select(
      'g.id as grupo_id',
      'g.nome as grupo_nome',
      db.raw('COALESCE(s.id, 0) as subgrupo_id'),
      db.raw("COALESCE(s.nome, 'Sem Subgrupo') as subgrupo_nome"),
      db.raw('MONTH(f.data_pagamento) as mes'),
    )
    .sum('f.valor_liquido as total')
    .groupBy('g.id', 'g.nome', 's.id', 's.nome', db.raw('MONTH(f.data_pagamento)'));

  applyRBAC(q1, user);
  applyRBAC(q2, user);

  const [rows1, rows2]: [any[], any[]] = await Promise.all([q1, q2]);
  const rows = [...rows1, ...rows2];

  // Agrupa em memória: grupo → subgrupo → mes → total
  const grupos: Record<string, {
    grupo_id: number; grupo_nome: string;
    subgrupos: Record<string, { subgrupo_id: number; subgrupo_nome: string; meses: number[]; total: number }>;
  }> = {};

  for (const r of rows) {
    const gk = String(r.grupo_id);
    if (!grupos[gk]) {
      grupos[gk] = { grupo_id: r.grupo_id, grupo_nome: r.grupo_nome, subgrupos: {} };
    }
    const sk = String(r.subgrupo_id);
    if (!grupos[gk].subgrupos[sk]) {
      grupos[gk].subgrupos[sk] = { subgrupo_id: r.subgrupo_id, subgrupo_nome: r.subgrupo_nome, meses: Array(12).fill(0), total: 0 };
    }
    const mes = Number(r.mes);
    const val = Number(r.total);
    if (mes >= 1 && mes <= 12) {
      grupos[gk].subgrupos[sk].meses[mes - 1] += val;
      grupos[gk].subgrupos[sk].total += val;
    }
  }

  // Calcula total por grupo
  const resultado = Object.values(grupos).map(g => {
    const subgrupos = Object.values(g.subgrupos);
    const mesesGrupo = Array(12).fill(0);
    let totalGrupo = 0;
    for (const s of subgrupos) {
      for (let i = 0; i < 12; i++) mesesGrupo[i] += s.meses[i];
      totalGrupo += s.total;
    }
    return { ...g, subgrupos, meses: mesesGrupo, total: totalGrupo };
  }).sort((a, b) => b.total - a.total);

  res.json({ ano, grupos: resultado });
}

// ── Listar metas ────────────────────────────────────────────────────────────
export async function getMetas(req: Request, res: Response): Promise<void> {
  const ano = parseInt(req.query.ano as string) || new Date().getFullYear();
  const user = (req as any).user;

  const q = db('planejamento_metas as m')
    .join('dim_subgrupo_despesa as s', 'm.fk_subgrupo', 's.id')
    .join('dim_grupo_despesa as g', 's.fk_grupo', 'g.id')
    .where('m.ano', ano)
    .select('m.*', 's.nome as subgrupo_nome', 'g.id as grupo_id', 'g.nome as grupo_nome');

  if (user?.role !== 'SUPER_ADMIN' && user?.fk_municipio) {
    q.where('m.fk_municipio', user.fk_municipio);
  }

  const metas = await q;
  res.json(metas);
}

// ── Salvar metas (upsert em lote) ───────────────────────────────────────────
export async function saveMetas(req: Request, res: Response): Promise<void> {
  const user = (req as any).user;
  const { metas } = req.body as {
    metas: Array<{
      ano: number; fk_subgrupo: number;
      meta_anual: number; percentual_ajuste: number; base_calculo: number; observacao?: string;
    }>;
  };

  if (!Array.isArray(metas) || metas.length === 0) {
    res.status(400).json({ error: 'Nenhuma meta informada' });
    return;
  }

  const fk_municipio = user?.role !== 'SUPER_ADMIN' ? (user?.fk_municipio ?? null) : null;

  for (const m of metas) {
    const existing = await db('planejamento_metas')
      .where({ ano: m.ano, fk_subgrupo: m.fk_subgrupo, fk_municipio })
      .first();

    if (existing) {
      await db('planejamento_metas')
        .where({ id: existing.id })
        .update({
          meta_anual: m.meta_anual,
          percentual_ajuste: m.percentual_ajuste,
          base_calculo: m.base_calculo,
          observacao: m.observacao ?? null,
          atualizado_em: new Date(),
        });
    } else {
      await db('planejamento_metas').insert({
        ano: m.ano,
        fk_subgrupo: m.fk_subgrupo,
        fk_municipio,
        meta_anual: m.meta_anual,
        percentual_ajuste: m.percentual_ajuste,
        base_calculo: m.base_calculo,
        observacao: m.observacao ?? null,
        criado_em: new Date(),
        atualizado_em: new Date(),
      });
    }
  }

  res.json({ ok: true, saved: metas.length });
}
