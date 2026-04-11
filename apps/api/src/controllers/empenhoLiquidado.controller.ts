import { Request, Response } from 'express';
import { db } from '../config/database';
import { getTenantFilter, applyTenantFilter } from '../middleware/auth.middleware';

function applyRBAC(q: any, user: any) {
  applyTenantFilter(q, getTenantFilter(user), 'f.fk_entidade', 'f.fk_municipio');
  return q;
}

// ── Matriz de evolução: saldo a pagar por grupo/subgrupo × período ────────────
export async function getMatrizEmpenhos(req: Request, res: Response): Promise<void> {
  const user = (req as any).user;

  // Todos os períodos disponíveis para este município
  const q = db('fact_empenho_liquidado as f')
    .select('f.periodo_ref')
    .groupBy('f.periodo_ref')
    .orderBy('f.periodo_ref', 'asc');
  applyRBAC(q, user);
  const periodos: string[] = (await q).map((r: any) => r.periodo_ref);

  if (periodos.length === 0) {
    res.json({ periodos: [], grupos: [], ultimo_periodo: null, total_a_pagar: 0 });
    return;
  }

  // Para cada período: saldo a pagar por grupo/subgrupo do credor
  // Usa dim_credor OU dim_credor_a_pagar (COALESCE)
  const rows = await db('fact_empenho_liquidado as f')
    .leftJoin('dim_credor as c',          'f.fk_credor',         'c.id')
    .leftJoin('dim_credor_a_pagar as cap', 'f.fk_credor_a_pagar', 'cap.id')
    .joinRaw('LEFT JOIN dim_grupo_despesa as g ON g.id = COALESCE(c.fk_grupo, cap.fk_grupo)')
    .joinRaw('LEFT JOIN dim_subgrupo_despesa as s ON s.id = COALESCE(c.fk_subgrupo, cap.fk_subgrupo)')
    .modify((q: any) => applyRBAC(q, user))
    .select(
      'f.periodo_ref',
      db.raw('COALESCE(g.id, 0) as grupo_id'),
      db.raw("COALESCE(g.nome, 'Sem Grupo') as grupo_nome"),
      db.raw('COALESCE(s.id, 0) as subgrupo_id'),
      db.raw("COALESCE(s.nome, 'Sem Subgrupo') as subgrupo_nome"),
    )
    .sum('f.valor as total')
    .whereNull('f.dt_pagamento')   // apenas os A PAGAR
    .groupBy('f.periodo_ref', 'g.id', 'g.nome', 's.id', 's.nome')
    .orderBy('f.periodo_ref');

  // Monta estrutura: grupo → subgrupo → período → valor
  const grupoMap: Record<string, {
    grupo_id: number; grupo_nome: string;
    subgrupos: Record<string, {
      subgrupo_id: number; subgrupo_nome: string;
      valores: Record<string, number>;
    }>;
  }> = {};

  for (const r of rows) {
    const gk = String(r.grupo_id);
    if (!grupoMap[gk]) grupoMap[gk] = { grupo_id: r.grupo_id, grupo_nome: r.grupo_nome, subgrupos: {} };
    const sk = String(r.subgrupo_id);
    if (!grupoMap[gk].subgrupos[sk]) {
      grupoMap[gk].subgrupos[sk] = { subgrupo_id: r.subgrupo_id, subgrupo_nome: r.subgrupo_nome, valores: {} };
    }
    grupoMap[gk].subgrupos[sk].valores[r.periodo_ref] = Number(r.total);
  }

  const ultimoPeriodo = periodos[periodos.length - 1];

  // Total a pagar no último período
  const totalAPagar = Object.values(grupoMap).reduce((sum, g) =>
    sum + Object.values(g.subgrupos).reduce((s2, sub) =>
      s2 + (sub.valores[ultimoPeriodo] ?? 0), 0), 0);

  const grupos = Object.values(grupoMap).map(g => ({
    ...g,
    subgrupos: Object.values(g.subgrupos),
    // total por período para a linha de grupo
    totais: periodos.reduce((acc, p) => {
      acc[p] = Object.values(g.subgrupos).reduce((s, sub) => s + (sub.valores[p] ?? 0), 0);
      return acc;
    }, {} as Record<string, number>),
  })).sort((a, b) => (b.totais[ultimoPeriodo] ?? 0) - (a.totais[ultimoPeriodo] ?? 0));

  res.json({ periodos, grupos, ultimo_periodo: ultimoPeriodo, total_a_pagar: totalAPagar });
}

// ── Resumo: total a pagar por entidade no último período ──────────────────────
export async function getResumoAPagar(req: Request, res: Response): Promise<void> {
  const user = (req as any).user;

  // Último período disponível
  const last = await db('fact_empenho_liquidado as f')
    .modify((q: any) => applyRBAC(q, user))
    .max('f.periodo_ref as ultimo')
    .first();

  const ultimoPeriodo = last?.ultimo;
  if (!ultimoPeriodo) {
    res.json({ ultimo_periodo: null, total_a_pagar: 0, por_entidade: [] });
    return;
  }

  const rows = await db('fact_empenho_liquidado as f')
    .join('dim_entidade as e', 'f.fk_entidade', 'e.id')
    .modify((q: any) => applyRBAC(q, user))
    .where('f.periodo_ref', ultimoPeriodo)
    .whereNull('f.dt_pagamento')
    .select('e.id as entidade_id', 'e.nome as entidade_nome')
    .sum('f.valor as total')
    .groupBy('e.id', 'e.nome')
    .orderBy('total', 'desc');

  const total = rows.reduce((a: number, r: any) => a + Number(r.total), 0);

  res.json({
    ultimo_periodo: ultimoPeriodo,
    total_a_pagar: total,
    por_entidade: rows.map((r: any) => ({ ...r, total: Number(r.total) })),
  });
}

// ── Listagem detalhada de empenhos a pagar ────────────────────────────────────
export async function getEmpenhosPendentes(req: Request, res: Response): Promise<void> {
  const user = (req as any).user;
  const periodo = req.query.periodo as string | undefined;
  const fk_entidade = req.query.fk_entidade ? parseInt(req.query.fk_entidade as string) : null;
  const fk_grupo = req.query.fk_grupo ? parseInt(req.query.fk_grupo as string) : null;

  const q = db('fact_empenho_liquidado as f')
    .leftJoin('dim_credor as c',           'f.fk_credor',         'c.id')
    .leftJoin('dim_credor_a_pagar as cap',  'f.fk_credor_a_pagar', 'cap.id')
    .joinRaw('LEFT JOIN dim_grupo_despesa as g ON g.id = COALESCE(c.fk_grupo, cap.fk_grupo)')
    .joinRaw('LEFT JOIN dim_subgrupo_despesa as s ON s.id = COALESCE(c.fk_subgrupo, cap.fk_subgrupo)')
    .leftJoin('dim_entidade as e',          'f.fk_entidade', 'e.id')
    .whereNull('f.dt_pagamento')
    .select(
      'f.id', 'f.dt_liquidacao', 'f.num_empenho', 'f.credor_nome',
      'f.historico', 'f.tipo_empenho', 'f.dt_empenho', 'f.valor',
      'f.periodo_ref', 'e.nome as entidade_nome',
      db.raw("COALESCE(g.nome, 'Sem Grupo') as grupo_nome"),
      db.raw("COALESCE(s.nome, 'Sem Subgrupo') as subgrupo_nome"),
    )
    .orderBy('f.valor', 'desc');

  applyRBAC(q, user);
  if (periodo)     q.where('f.periodo_ref', periodo);
  if (fk_entidade) q.where('f.fk_entidade', fk_entidade);
  if (fk_grupo)    q.where('g.id', fk_grupo);

  const rows = await q;
  res.json(rows);
}

// ── Listagem paginada para tela de Análise (padrão /pagamentos) ───────────────
export async function getListagem(req: Request, res: Response): Promise<void> {
  const user = (req as any).user;
  const page    = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit   = Math.min(100, parseInt(req.query.limit as string) || 20);
  const offset  = (page - 1) * limit;
  const sortBy  = (req.query.sortBy as string) || 'valor';
  const sortDir = (req.query.sortDir as string) === 'asc' ? 'asc' : 'desc';

  // Filtros
  const periodo     = req.query.periodo    as string | undefined;
  const fk_entidade = req.query.fk_entidade ? parseInt(req.query.fk_entidade as string) : null;
  const fk_grupo    = req.query.fk_grupo    ? parseInt(req.query.fk_grupo    as string) : null;
  const fk_subgrupo = req.query.fk_subgrupo ? parseInt(req.query.fk_subgrupo as string) : null;
  const credor      = req.query.credor      as string | undefined;
  const semGrupo    = req.query.semGrupo    === '1';
  const semSubgrupo = req.query.semSubgrupo === '1';

  function buildBase({ ignorarSemFiltros = false } = {}) {
    const q = db('fact_empenho_liquidado as f')
      .leftJoin('dim_credor as c',           'f.fk_credor',         'c.id')
      .leftJoin('dim_credor_a_pagar as cap',  'f.fk_credor_a_pagar', 'cap.id')
      .joinRaw('LEFT JOIN dim_grupo_despesa as g ON g.id = COALESCE(c.fk_grupo, cap.fk_grupo)')
      .joinRaw('LEFT JOIN dim_subgrupo_despesa as s ON s.id = COALESCE(c.fk_subgrupo, cap.fk_subgrupo)')
      .leftJoin('dim_entidade as e',          'f.fk_entidade', 'e.id')
      .whereNull('f.dt_pagamento')
      .modify((q: any) => applyRBAC(q, user));

    if (periodo)     q.where('f.periodo_ref', periodo);
    if (fk_entidade) q.where('f.fk_entidade', fk_entidade);
    if (fk_grupo)    q.where('g.id', fk_grupo);
    if (fk_subgrupo) q.where('s.id', fk_subgrupo);
    if (credor)      q.whereRaw('UPPER(f.credor_nome) LIKE ?', [`%${credor.toUpperCase()}%`]);

    // filtros de classificação — ignorados nos stats de contagem
    if (!ignorarSemFiltros) {
      if (semGrupo)    q.whereNull('g.id');
      if (semSubgrupo) q.whereNotNull('g.id').whereNull('s.id');
    }

    return q;
  }

  const SORT_MAP: Record<string, string> = {
    valor: 'f.valor', dt_liquidacao: 'f.dt_liquidacao', dt_empenho: 'f.dt_empenho',
    credor_nome: 'f.credor_nome', grupo_nome: 'g.nome', subgrupo_nome: 's.nome',
    entidade_nome: 'e.nome', periodo_ref: 'f.periodo_ref',
  };
  const sortCol = SORT_MAP[sortBy] ?? 'f.valor';

  const [rows, countRows] = await Promise.all([
    buildBase()
      .select(
        'f.id', 'f.dt_liquidacao', 'f.num_empenho', 'f.num_reduzido',
        'f.credor_nome', 'f.historico', 'f.tipo_empenho', 'f.dt_empenho',
        'f.valor', 'f.periodo_ref', 'f.classificacao_orc', 'f.fk_credor', 'f.fk_credor_a_pagar',
        'e.nome as entidade_nome',
        db.raw('COALESCE(c.fk_grupo, cap.fk_grupo) as fk_grupo'),
        db.raw('COALESCE(c.fk_subgrupo, cap.fk_subgrupo) as fk_subgrupo'),
        db.raw('g.nome as grupo_nome'),
        db.raw('s.nome as subgrupo_nome'),
      )
      .orderBy(sortCol, sortDir)
      .limit(limit)
      .offset(offset),
    buildBase().count('f.id as total').first(),
  ]);

  // Stats
  const statsQ = buildBase()
    .count('f.id as total_registros')
    .sum('f.valor as valor_total')
    .countDistinct('f.credor_nome as total_credores');
  const semGrupoQ    = buildBase({ ignorarSemFiltros: true }).whereNull('g.id').count('f.id as n').first();
  const semSubgrupoQ = buildBase({ ignorarSemFiltros: true }).whereNotNull('g.id').whereNull('s.id').count('f.id as n').first();

  const [statsRows, semGrupoRow, semSubgrupoRow] = await Promise.all([statsQ.first(), semGrupoQ, semSubgrupoQ]);

  res.json({
    rows,
    total: Number((countRows as any)?.total ?? 0),
    page,
    limit,
    stats: {
      total_registros: Number((statsRows as any)?.total_registros ?? 0),
      valor_total: Number((statsRows as any)?.valor_total ?? 0),
      total_credores: Number((statsRows as any)?.total_credores ?? 0),
      sem_grupo:     Number((semGrupoRow as any)?.n ?? 0),
      sem_subgrupo:  Number((semSubgrupoRow as any)?.n ?? 0),
    },
  });
}

// ── Credores com maior saldo a pagar (todos, com qtd empenhos e % sobre total) ─
export async function getTopCredores(req: Request, res: Response): Promise<void> {
  const user = (req as any).user;
  const periodo = req.query.periodo as string | undefined;

  const last = await db('fact_empenho_liquidado as f')
    .modify((q: any) => applyRBAC(q, user))
    .max('f.periodo_ref as ultimo').first();
  const ultimoPeriodo = periodo || last?.ultimo;
  if (!ultimoPeriodo) { res.json({ rows: [], total_geral: 0 }); return; }

  const rows = await db('fact_empenho_liquidado as f')
    .leftJoin('dim_credor as c',           'f.fk_credor',         'c.id')
    .leftJoin('dim_credor_a_pagar as cap',  'f.fk_credor_a_pagar', 'cap.id')
    .joinRaw('LEFT JOIN dim_grupo_despesa as g ON g.id = COALESCE(c.fk_grupo, cap.fk_grupo)')
    .modify((q: any) => applyRBAC(q, user))
    .where('f.periodo_ref', ultimoPeriodo)
    .whereNull('f.dt_pagamento')
    .select(
      'f.credor_nome',
      db.raw("COALESCE(g.nome, 'Sem Grupo') as grupo_nome"),
    )
    .sum('f.valor as total')
    .count('f.id as qtd')
    .groupBy('f.credor_nome', 'g.nome')
    .orderBy('total', 'desc');

  const totalGeral = rows.reduce((s: number, r: any) => s + Number(r.total), 0);

  res.json({
    rows: rows.map((r: any) => ({
      credor_nome: r.credor_nome,
      grupo_nome: r.grupo_nome,
      total: Number(r.total),
      qtd: Number(r.qtd),
      pct: totalGeral > 0 ? Math.round((Number(r.total) / totalGeral) * 1000) / 10 : 0,
    })),
    total_geral: totalGeral,
  });
}

// ── Aging: distribuição por faixa de tempo em aberto ─────────────────────────
export async function getAging(req: Request, res: Response): Promise<void> {
  const user = (req as any).user;

  const last = await db('fact_empenho_liquidado as f')
    .modify((q: any) => applyRBAC(q, user))
    .max('f.periodo_ref as ultimo').first();
  const ultimoPeriodo = last?.ultimo;
  if (!ultimoPeriodo) { res.json({ faixas: [] }); return; }

  const rows = await db('fact_empenho_liquidado as f')
    .modify((q: any) => applyRBAC(q, user))
    .where('f.periodo_ref', ultimoPeriodo)
    .whereNull('f.dt_pagamento')
    .whereNotNull('f.dt_empenho')
    .select(
      db.raw("(CURRENT_DATE - f.dt_empenho::date) as dias"),
      'f.valor',
    );

  const faixas = [
    { label: '0–30 dias',   min: 0,   max: 30,  total: 0, qtd: 0 },
    { label: '31–60 dias',  min: 31,  max: 60,  total: 0, qtd: 0 },
    { label: '61–90 dias',  min: 61,  max: 90,  total: 0, qtd: 0 },
    { label: '91–180 dias', min: 91,  max: 180, total: 0, qtd: 0 },
    { label: '+180 dias',   min: 181, max: Infinity, total: 0, qtd: 0 },
  ];

  for (const r of rows) {
    const dias = Number(r.dias);
    const valor = Number(r.valor);
    const faixa = faixas.find(f => dias >= f.min && dias <= f.max);
    if (faixa) { faixa.total += valor; faixa.qtd++; }
  }

  const maisAntigo = rows.length > 0 ? Math.max(...rows.map((r: any) => Number(r.dias))) : 0;

  res.json({ faixas, mais_antigo_dias: maisAntigo, ultimo_periodo: ultimoPeriodo });
}

// ── Evolução mensal do saldo a pagar ─────────────────────────────────────────
export async function getEvolucao(req: Request, res: Response): Promise<void> {
  const user = (req as any).user;

  const rows = await db('fact_empenho_liquidado as f')
    .modify((q: any) => applyRBAC(q, user))
    .whereNull('f.dt_pagamento')
    .select('f.periodo_ref')
    .sum('f.valor as total')
    .count('f.id as qtd')
    .groupBy('f.periodo_ref')
    .orderBy('f.periodo_ref', 'asc');

  res.json(rows.map((r: any) => ({
    periodo: r.periodo_ref,
    total: Number(r.total),
    qtd: Number(r.qtd),
  })));
}

// ── Períodos disponíveis ──────────────────────────────────────────────────────
export async function getPeriodos(req: Request, res: Response): Promise<void> {
  const user = (req as any).user;
  const q = db('fact_empenho_liquidado as f')
    .select('f.periodo_ref')
    .groupBy('f.periodo_ref')
    .orderBy('f.periodo_ref', 'asc');
  applyRBAC(q, user);
  const rows = await q;
  res.json(rows.map((r: any) => r.periodo_ref));
}
