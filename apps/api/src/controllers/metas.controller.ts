import { Request, Response } from 'express';
import { db } from '../config/database';
import { isSuperAdmin } from '../config/roles';

function applyRBAC(q: any, user: any) {
  if (!isSuperAdmin(user?.role) && user?.fk_municipio) {
    q.where('f.fk_municipio', user.fk_municipio);
  }
  return q;
}

// ── Despesa Real de um ano ──────────────────────────────────────────────────
// Regra (usando tipo_relatorio + classificação original do credor):
//   tipo_relatorio = 'OR' pago em ANO         → despesa própria do ANO
//   tipo_relatorio = 'DEA' ou 'RP' pago em ANO+1 → pertence ao ANO
// Grupo/Subgrupo: sempre do credor (classificação original)
export async function getDespesaReal(req: Request, res: Response): Promise<void> {
  const ano = parseInt(req.query.ano as string) || new Date().getFullYear() - 1;
  const user = (req as any).user;

  // Pagamentos do próprio ano (tipo OR — excluindo DEA e RP)
  const q1 = db('fact_ordem_pagamento as f')
    .join('dim_credor as c', 'f.fk_credor', 'c.id')
    .join('dim_grupo_despesa as g', 'c.fk_grupo', 'g.id')
    .leftJoin('dim_subgrupo_despesa as s', 'c.fk_subgrupo', 's.id')
    .whereRaw('YEAR(f.data_pagamento) = ?', [ano])
    .whereNotIn('f.tipo_relatorio', ['DEA', 'RP'])
    .whereNotNull('f.data_pagamento')
    .select(
      'g.id as grupo_id',
      'g.nome as grupo_nome',
      db.raw('COALESCE(s.id, 0) as subgrupo_id'),
      db.raw("COALESCE(s.nome, 'Sem Subgrupo') as subgrupo_nome"),
      db.raw('MONTH(f.data_pagamento) as mes'),
    )
    .sum('f.valor_bruto as total')
    .groupBy('g.id', 'g.nome', 's.id', 's.nome', db.raw('MONTH(f.data_pagamento)'));

  // Pagamentos DEA/RP do ano seguinte → pertencem ao ANO
  // Usa grupo/subgrupo do CREDOR (classificação original, não o DEA prefixado)
  const q2 = db('fact_ordem_pagamento as f')
    .join('dim_credor as c', 'f.fk_credor', 'c.id')
    .join('dim_grupo_despesa as g', 'c.fk_grupo', 'g.id')
    .leftJoin('dim_subgrupo_despesa as s', 'c.fk_subgrupo', 's.id')
    .whereRaw('YEAR(f.data_pagamento) = ?', [ano + 1])
    .whereIn('f.tipo_relatorio', ['DEA', 'RP'])
    .whereNotNull('f.data_pagamento')
    .select(
      'g.id as grupo_id',
      'g.nome as grupo_nome',
      db.raw('COALESCE(s.id, 0) as subgrupo_id'),
      db.raw("COALESCE(s.nome, 'Sem Subgrupo') as subgrupo_nome"),
      db.raw('MONTH(f.data_pagamento) as mes'),
    )
    .sum('f.valor_bruto as total')
    .groupBy('g.id', 'g.nome', 's.id', 's.nome', db.raw('MONTH(f.data_pagamento)'));

  applyRBAC(q1, user);
  applyRBAC(q2, user);

  const [rows1, rows2]: [any[], any[]] = await Promise.all([q1, q2]);

  // Agrupa em memória: grupo → subgrupo → mes → total
  // rows1 = pagamentos do próprio ano (meses 1-12)
  // rows2 = DEA/RP do ano seguinte (coluna separada dea_rp)
  const grupos: Record<string, {
    grupo_id: number; grupo_nome: string;
    subgrupos: Record<string, { subgrupo_id: number; subgrupo_nome: string; meses: number[]; dea_rp: number; total: number }>;
  }> = {};

  const upsertSub = (gk: string, r: any) => {
    if (!grupos[gk]) grupos[gk] = { grupo_id: r.grupo_id, grupo_nome: r.grupo_nome, subgrupos: {} };
    const sk = String(r.subgrupo_id);
    if (!grupos[gk].subgrupos[sk]) {
      grupos[gk].subgrupos[sk] = { subgrupo_id: r.subgrupo_id, subgrupo_nome: r.subgrupo_nome, meses: Array(12).fill(0), dea_rp: 0, total: 0 };
    }
    return grupos[gk].subgrupos[sk];
  };

  for (const r of rows1) {
    const sub = upsertSub(String(r.grupo_id), r);
    const mes = Number(r.mes);
    const val = Number(r.total);
    if (mes >= 1 && mes <= 12) { sub.meses[mes - 1] += val; sub.total += val; }
  }

  for (const r of rows2) {
    const sub = upsertSub(String(r.grupo_id), r);
    const val = Number(r.total);
    sub.dea_rp += val;
    sub.total  += val;
  }

  // Calcula total por grupo
  const resultado = Object.values(grupos).map(g => {
    const subgrupos = Object.values(g.subgrupos);
    const mesesGrupo = Array(12).fill(0);
    let totalGrupo = 0;
    let deaRpGrupo = 0;
    for (const s of subgrupos) {
      for (let i = 0; i < 12; i++) mesesGrupo[i] += s.meses[i];
      totalGrupo  += s.total;
      deaRpGrupo  += s.dea_rp;
    }
    return { ...g, subgrupos, meses: mesesGrupo, dea_rp: deaRpGrupo, total: totalGrupo };
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

  if (!isSuperAdmin(user?.role) && user?.fk_municipio) {
    q.where('m.fk_municipio', user.fk_municipio);
  }

  const metas = await q;
  res.json(metas);
}

// ── Executado: pagamentos reais do ano da meta, agrupados por subgrupo ──────
export async function getExecutado(req: Request, res: Response): Promise<void> {
  const ano = parseInt(req.query.ano as string) || new Date().getFullYear();
  const mes = req.query.mes ? parseInt(req.query.mes as string) : null;
  const fk_entidade = req.query.fk_entidade ? parseInt(req.query.fk_entidade as string) : null;
  const fk_grupo = req.query.fk_grupo ? parseInt(req.query.fk_grupo as string) : null;
  const fk_subgrupo = req.query.fk_subgrupo ? parseInt(req.query.fk_subgrupo as string) : null;
  const user = (req as any).user;

  // q1: pagamentos OR do próprio ano
  const q1 = db('fact_ordem_pagamento as f')
    .join('dim_credor as c', 'f.fk_credor', 'c.id')
    .join('dim_grupo_despesa as g', 'c.fk_grupo', 'g.id')
    .leftJoin('dim_subgrupo_despesa as s', 'c.fk_subgrupo', 's.id')
    .whereRaw('YEAR(f.data_pagamento) = ?', [ano])
    .whereNotIn('f.tipo_relatorio', ['DEA', 'RP'])
    .whereNotNull('f.data_pagamento')
    .select(
      'g.id as grupo_id', 'g.nome as grupo_nome',
      db.raw('COALESCE(s.id, 0) as subgrupo_id'),
      db.raw("COALESCE(s.nome, 'Sem Subgrupo') as subgrupo_nome"),
      db.raw('MONTH(f.data_pagamento) as mes'),
    )
    .sum('f.valor_bruto as total')
    .groupBy('g.id', 'g.nome', 's.id', 's.nome', db.raw('MONTH(f.data_pagamento)'));

  // q2: DEA/RP pagos em ano+1 que pertencem a este ano
  const q2 = db('fact_ordem_pagamento as f')
    .join('dim_credor as c', 'f.fk_credor', 'c.id')
    .join('dim_grupo_despesa as g', 'c.fk_grupo', 'g.id')
    .leftJoin('dim_subgrupo_despesa as s', 'c.fk_subgrupo', 's.id')
    .whereRaw('YEAR(f.data_pagamento) = ?', [ano + 1])
    .whereIn('f.tipo_relatorio', ['DEA', 'RP'])
    .whereNotNull('f.data_pagamento')
    .select(
      'g.id as grupo_id', 'g.nome as grupo_nome',
      db.raw('COALESCE(s.id, 0) as subgrupo_id'),
      db.raw("COALESCE(s.nome, 'Sem Subgrupo') as subgrupo_nome"),
      db.raw('MONTH(f.data_pagamento) as mes'),
    )
    .sum('f.valor_bruto as total')
    .groupBy('g.id', 'g.nome', 's.id', 's.nome', db.raw('MONTH(f.data_pagamento)'));

  // Filtros opcionais
  if (fk_entidade) { q1.where('f.fk_entidade', fk_entidade); q2.where('f.fk_entidade', fk_entidade); }
  if (fk_grupo)    { q1.where('g.id', fk_grupo);    q2.where('g.id', fk_grupo); }
  if (fk_subgrupo) { q1.where('s.id', fk_subgrupo); q2.where('s.id', fk_subgrupo); }
  if (mes)         { q1.whereRaw('MONTH(f.data_pagamento) = ?', [mes]); }
  applyRBAC(q1, user); applyRBAC(q2, user);

  const [rows1, rows2]: [any[], any[]] = await Promise.all([q1, q2]);

  const subs: Record<string, {
    grupo_id: number; grupo_nome: string; subgrupo_id: number; subgrupo_nome: string;
    meses: number[]; total: number;
  }> = {};

  const upsert = (r: any) => {
    const k = `${r.grupo_id}_${r.subgrupo_id}`;
    if (!subs[k]) subs[k] = { grupo_id: r.grupo_id, grupo_nome: r.grupo_nome, subgrupo_id: r.subgrupo_id, subgrupo_nome: r.subgrupo_nome, meses: Array(12).fill(0), total: 0 };
    return subs[k];
  };

  for (const r of rows1) {
    const s = upsert(r); const m = Number(r.mes); const v = Number(r.total);
    if (m >= 1 && m <= 12 && (!mes || m === mes)) { s.meses[m - 1] += v; s.total += v; }
  }
  for (const r of rows2) {
    const s = upsert(r); const v = Number(r.total);
    s.total += v;
  }

  res.json({ ano, mes, subgrupos: Object.values(subs) });
}

// ── Listar entidades disponíveis para filtro ─────────────────────────────────
export async function getEntidadesFiltro(req: Request, res: Response): Promise<void> {
  const user = (req as any).user;
  const q = db('dim_entidade').select('id', 'nome').orderBy('nome');
  if (!isSuperAdmin(user?.role) && user?.fk_municipio) {
    q.where('fk_municipio', user.fk_municipio);
  }
  res.json(await q);
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

  const fk_municipio = !isSuperAdmin(user?.role) ? (user?.fk_municipio ?? null) : null;

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
