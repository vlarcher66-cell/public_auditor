import { Request, Response } from 'express';
import { db } from '../config/database';
import { getTenantFilter, applyTenantFilter } from '../middleware/auth.middleware';

function applyRBAC(q: any, user: any) {
  applyTenantFilter(q, getTenantFilter(user), 'f.fk_entidade', 'f.fk_municipio');
  return q;
}

// ── Matriz de contas a pagar: grupos × mês de liquidação (acumulado do ano) ───
// Lógica: empenhos liquidados de 01/jan até hoje, agrupados pelo mês de dt_liquidacao.
// Só aparecem nas linhas de grupo os que ainda não foram pagos (dt_pagamento IS NULL).
// As linhas de rodapé (liquidado/pago/saldo) usam todos os empenhos do período.
export async function getMatrizEmpenhos(req: Request, res: Response): Promise<void> {
  const user = (req as any).user;

  // Ano vigente e intervalo 01/jan → hoje
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const dataInicio = `${ano}-01-01`;
  const dataFim = hoje.toISOString().slice(0, 10);

  // Anos com dados (para o seletor de ano no frontend)
  const anosQ = db('fact_empenho_liquidado as f')
    .modify((q: any) => applyRBAC(q, user))
    .whereNotNull('f.dt_liquidacao')
    .select(db.raw("TO_CHAR(f.dt_liquidacao, 'YYYY') as ano"))
    .groupByRaw("TO_CHAR(f.dt_liquidacao, 'YYYY')")
    .orderByRaw("TO_CHAR(f.dt_liquidacao, 'YYYY') asc");
  const anosRows = await anosQ;
  const anos: string[] = anosRows.map((r: any) => r.ano);

  // Ano selecionado via query param (padrão = ano atual)
  const anoSel: string = (req.query.ano as string) || String(ano);
  const inicioSel = `${anoSel}-01-01`;
  const fimSel = anoSel === String(ano) ? dataFim : `${anoSel}-12-31`;

  // 12 períodos fixos do ano selecionado
  const periodos = Array.from({ length: 12 }, (_, i) =>
    `${anoSel}-${String(i + 1).padStart(2, '0')}`
  );

  // Linhas dos grupos: só empenhos A PAGAR (dt_pagamento IS NULL), agrupados por mês de dt_liquidacao
  const rows = await db('fact_empenho_liquidado as f')
    .leftJoin('dim_credor as c',          'f.fk_credor',         'c.id')
    .leftJoin('dim_credor_a_pagar as cap', 'f.fk_credor_a_pagar', 'cap.id')
    .joinRaw('LEFT JOIN dim_grupo_despesa as g ON g.id = COALESCE(c.fk_grupo, cap.fk_grupo)')
    .joinRaw('LEFT JOIN dim_subgrupo_despesa as s ON s.id = COALESCE(c.fk_subgrupo, cap.fk_subgrupo)')
    .modify((q: any) => applyRBAC(q, user))
    .whereNull('f.dt_pagamento')
    .whereNotNull('f.dt_liquidacao')
    .whereRaw('f.dt_liquidacao::date >= ?', [inicioSel])
    .whereRaw('f.dt_liquidacao::date <= ?', [fimSel])
    .select(
      db.raw("TO_CHAR(f.dt_liquidacao, 'YYYY-MM') as mes_liq"),
      db.raw('COALESCE(g.id, 0) as grupo_id'),
      db.raw("COALESCE(g.nome, 'Sem Grupo') as grupo_nome"),
      db.raw('COALESCE(s.id, 0) as subgrupo_id'),
      db.raw("COALESCE(s.nome, 'Sem Subgrupo') as subgrupo_nome"),
    )
    .sum('f.valor as total')
    .groupByRaw("TO_CHAR(f.dt_liquidacao, 'YYYY-MM'), g.id, g.nome, s.id, s.nome")
    .orderByRaw("TO_CHAR(f.dt_liquidacao, 'YYYY-MM')");

  // Total pago por mês de liquidação (dt_pagamento IS NOT NULL)
  const rowsPago = await db('fact_empenho_liquidado as f')
    .modify((q: any) => applyRBAC(q, user))
    .whereNotNull('f.dt_pagamento')
    .whereNotNull('f.dt_liquidacao')
    .whereRaw('f.dt_liquidacao::date >= ?', [inicioSel])
    .whereRaw('f.dt_liquidacao::date <= ?', [fimSel])
    .select(db.raw("TO_CHAR(f.dt_liquidacao, 'YYYY-MM') as mes_liq"))
    .sum('f.valor as total')
    .groupByRaw("TO_CHAR(f.dt_liquidacao, 'YYYY-MM')");

  // Total liquidado por mês (todos — pago + a pagar)
  const rowsLiquidado = await db('fact_empenho_liquidado as f')
    .modify((q: any) => applyRBAC(q, user))
    .whereNotNull('f.dt_liquidacao')
    .whereRaw('f.dt_liquidacao::date >= ?', [inicioSel])
    .whereRaw('f.dt_liquidacao::date <= ?', [fimSel])
    .select(db.raw("TO_CHAR(f.dt_liquidacao, 'YYYY-MM') as mes_liq"))
    .sum('f.valor as total')
    .groupByRaw("TO_CHAR(f.dt_liquidacao, 'YYYY-MM')");

  const totalPagoPorPeriodo: Record<string, number> = {};
  for (const r of rowsPago) totalPagoPorPeriodo[r.mes_liq] = Number(r.total);

  const totalLiquidadoPorPeriodo: Record<string, number> = {};
  for (const r of rowsLiquidado) totalLiquidadoPorPeriodo[r.mes_liq] = Number(r.total);

  // Monta estrutura: grupo → subgrupo → mes_liq → valor (só a pagar)
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
    grupoMap[gk].subgrupos[sk].valores[r.mes_liq] = Number(r.total);
  }

  // Total a pagar geral (soma de todos os grupos em todos os meses)
  const totalAPagar = Object.values(grupoMap).reduce((sum, g) =>
    sum + Object.values(g.subgrupos).reduce((s2, sub) =>
      s2 + Object.values(sub.valores).reduce((s3, v) => s3 + v, 0), 0), 0);

  const ultimoMesComDados = periodos.filter(p => totalLiquidadoPorPeriodo[p] > 0).slice(-1)[0] ?? periodos[new Date().getMonth()];

  const grupos = Object.values(grupoMap).map(g => ({
    ...g,
    subgrupos: Object.values(g.subgrupos),
    totais: periodos.reduce((acc, p) => {
      acc[p] = Object.values(g.subgrupos).reduce((s, sub) => s + (sub.valores[p] ?? 0), 0);
      return acc;
    }, {} as Record<string, number>),
  })).sort((a, b) => {
    const totA = periodos.reduce((s, p) => s + (a.totais[p] ?? 0), 0);
    const totB = periodos.reduce((s, p) => s + (b.totais[p] ?? 0), 0);
    return totB - totA;
  });

  res.json({
    periodos,
    anos,
    ano_selecionado: anoSel,
    grupos,
    ultimo_periodo: ultimoMesComDados,
    total_a_pagar: totalAPagar,
    total_pago_por_periodo: totalPagoPorPeriodo,
    total_liquidado_por_periodo: totalLiquidadoPorPeriodo,
  });
}

// ── Resumo: total a pagar acumulado do ano ────────────────────────────────────
export async function getResumoAPagar(req: Request, res: Response): Promise<void> {
  const user = (req as any).user;
  const ano = new Date().getFullYear();
  const dataInicio = `${ano}-01-01`;

  // Descobre o último mês fechado com dados (maior mes_liq com dt_pagamento IS NULL)
  const ultimoMesRow = await db('fact_empenho_liquidado as f')
    .modify((q: any) => applyRBAC(q, user))
    .whereNull('f.dt_pagamento')
    .whereNotNull('f.dt_liquidacao')
    .whereRaw('f.dt_liquidacao::date >= ?', [dataInicio])
    .select(db.raw("MAX(TO_CHAR(f.dt_liquidacao, 'YYYY-MM')) as mes_liq"))
    .first();

  const ultimoMes: string = (ultimoMesRow as any)?.mes_liq ?? new Date().toISOString().slice(0, 7);
  // Último dia do mês fechado
  const [anoMes, numMes] = ultimoMes.split('-').map(Number);
  const dataFim = new Date(anoMes, numMes, 0).toISOString().slice(0, 10);

  const baseQuery = () => db('fact_empenho_liquidado as f')
    .modify((q: any) => applyRBAC(q, user))
    .whereNull('f.dt_pagamento')
    .whereNotNull('f.dt_liquidacao')
    .whereRaw('f.dt_liquidacao::date >= ?', [dataInicio])
    .whereRaw('f.dt_liquidacao::date <= ?', [dataFim]);

  const [rows, rowsMes] = await Promise.all([
    baseQuery()
      .join('dim_entidade as e', 'f.fk_entidade', 'e.id')
      .select('e.id as entidade_id', 'e.nome as entidade_nome')
      .sum('f.valor as total')
      .groupBy('e.id', 'e.nome')
      .orderBy('total', 'desc'),
    baseQuery()
      .select(db.raw("TO_CHAR(f.dt_liquidacao, 'YYYY-MM') as mes_liq"))
      .sum('f.valor as total')
      .groupByRaw("TO_CHAR(f.dt_liquidacao, 'YYYY-MM')"),
  ]);

  const total = rows.reduce((a: number, r: any) => a + Number(r.total), 0);

  const por_mes: Record<string, number> = {};
  for (const r of rowsMes) por_mes[r.mes_liq] = Number(r.total);

  res.json({
    ultimo_periodo: `${ano}-01 a ${ultimoMes}`,
    total_a_pagar: total,
    por_entidade: rows.map((r: any) => ({ ...r, total: Number(r.total) })),
    por_mes,
  });
}

// ── Listagem detalhada de empenhos a pagar (acumulado do ano) ────────────────
export async function getEmpenhosPendentes(req: Request, res: Response): Promise<void> {
  const user = (req as any).user;
  const fk_entidade = req.query.fk_entidade ? parseInt(req.query.fk_entidade as string) : null;
  const fk_grupo    = req.query.fk_grupo    ? parseInt(req.query.fk_grupo    as string) : null;
  const ano = new Date().getFullYear();
  const dataInicio = `${ano}-01-01`;
  const dataFim = new Date().toISOString().slice(0, 10);

  const q = db('fact_empenho_liquidado as f')
    .leftJoin('dim_credor as c',           'f.fk_credor',         'c.id')
    .leftJoin('dim_credor_a_pagar as cap',  'f.fk_credor_a_pagar', 'cap.id')
    .joinRaw('LEFT JOIN dim_grupo_despesa as g ON g.id = COALESCE(c.fk_grupo, cap.fk_grupo)')
    .joinRaw('LEFT JOIN dim_subgrupo_despesa as s ON s.id = COALESCE(c.fk_subgrupo, cap.fk_subgrupo)')
    .leftJoin('dim_entidade as e',          'f.fk_entidade', 'e.id')
    .whereNull('f.dt_pagamento')
    .whereNotNull('f.dt_liquidacao')
    .whereRaw('f.dt_liquidacao::date >= ?', [dataInicio])
    .whereRaw('f.dt_liquidacao::date <= ?', [dataFim])
    .select(
      'f.id', 'f.dt_liquidacao', 'f.num_empenho', 'f.credor_nome',
      'f.historico', 'f.tipo_empenho', 'f.dt_empenho', 'f.valor',
      'f.periodo_ref', 'e.nome as entidade_nome',
      db.raw("COALESCE(g.nome, 'Sem Grupo') as grupo_nome"),
      db.raw("COALESCE(s.nome, 'Sem Subgrupo') as subgrupo_nome"),
    )
    .orderBy('f.valor', 'desc');

  applyRBAC(q, user);
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

// ── Credores com maior saldo a pagar — acumulado do ano ──────────────────────
export async function getTopCredores(req: Request, res: Response): Promise<void> {
  const user = (req as any).user;
  const ano = new Date().getFullYear();
  const dataInicio = `${ano}-01-01`;
  const dataFim = new Date().toISOString().slice(0, 10);

  const rows = await db('fact_empenho_liquidado as f')
    .leftJoin('dim_credor as c',           'f.fk_credor',         'c.id')
    .leftJoin('dim_credor_a_pagar as cap',  'f.fk_credor_a_pagar', 'cap.id')
    .joinRaw('LEFT JOIN dim_grupo_despesa as g ON g.id = COALESCE(c.fk_grupo, cap.fk_grupo)')
    .modify((q: any) => applyRBAC(q, user))
    .whereNull('f.dt_pagamento')
    .whereNotNull('f.dt_liquidacao')
    .whereRaw('f.dt_liquidacao::date >= ?', [dataInicio])
    .whereRaw('f.dt_liquidacao::date <= ?', [dataFim])
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

// ── Aging: distribuição por faixa de tempo — acumulado do ano ────────────────
export async function getAging(req: Request, res: Response): Promise<void> {
  const user = (req as any).user;
  const ano = new Date().getFullYear();
  const dataInicio = `${ano}-01-01`;
  const dataFim = new Date().toISOString().slice(0, 10);

  const rows = await db('fact_empenho_liquidado as f')
    .modify((q: any) => applyRBAC(q, user))
    .whereNull('f.dt_pagamento')
    .whereNotNull('f.dt_liquidacao')
    .whereRaw('f.dt_liquidacao::date >= ?', [dataInicio])
    .whereRaw('f.dt_liquidacao::date <= ?', [dataFim])
    .select(
      db.raw("(CURRENT_DATE - f.dt_liquidacao::date) as dias"),
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

  res.json({ faixas, mais_antigo_dias: maisAntigo, ultimo_periodo: `${ano}-01 a ${dataFim.slice(0, 7)}` });
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
