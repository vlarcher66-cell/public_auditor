import { Request, Response } from 'express';
import { db } from '../config/database';
import { getTenantFilter, applyTenantFilter } from '../middleware/auth.middleware';

// ─── Listagem de receitas ─────────────────────────────────────────────────────

export async function listReceitas(req: Request, res: Response): Promise<void> {
  const {
    dataInicio, dataFim,
    entidadeId, municipioId,
    tipo, fonte,
    fornecedor,
    valorMin, valorMax,
    ano, mes,
    page = '1', limit = '50',
    sortBy = 'data_receita', sortDir = 'desc',
  } = req.query as Record<string, string>;

  const pg  = Math.max(1, parseInt(page));
  const lim = Math.min(200, parseInt(limit));
  const off = (pg - 1) * lim;

  const ALLOWED_SORT = ['data_receita', 'valor', 'conhecimento', 'fonte_recurso', 'tipo_receita', 'fornecedor_nome'];
  const sortCol = ALLOWED_SORT.includes(sortBy) ? `r.${sortBy}` : 'r.data_receita';
  const sortDir_ = sortDir === 'asc' ? 'asc' : 'desc';

  const baseQuery = () =>
    db('fact_receita as r')
      .join('dim_entidade as e', 'r.fk_entidade', 'e.id')
      .modify((q) => {
        if (dataInicio)  q.where('r.data_receita', '>=', dataInicio);
        if (dataFim)     q.where('r.data_receita', '<=', dataFim);
        if (entidadeId)  q.where('r.fk_entidade', parseInt(entidadeId));
        if (municipioId) q.where('r.fk_municipio', parseInt(municipioId));
        if (tipo)        q.where('r.tipo_receita', tipo);
        if (fonte)       q.where('r.fonte_recurso', fonte);
        if (ano)         q.where('r.ano', parseInt(ano));
        if (mes)         q.where('r.mes', parseInt(mes));
        if (valorMin)    q.where('r.valor', '>=', parseFloat(valorMin));
        if (valorMax)    q.where('r.valor', '<=', parseFloat(valorMax));
        if (fornecedor) {
          const like = `%${fornecedor}%`;
          q.where((w) => w.where('r.fornecedor_nome', 'ilike', like).orWhere('r.descricao', 'ilike', like));
        }
        // Filtro por role do usuário
        applyTenantFilter(q, getTenantFilter((req as any).user), 'r.fk_entidade', 'r.fk_municipio');
      });

  const [rows, countRows] = await Promise.all([
    baseQuery()
      .select(
        'r.id', 'r.data_receita', 'r.conhecimento', 'r.num_empenho',
        'r.codigo_rubrica', 'r.descricao', 'r.fornecedor_nome', 'r.fornecedor_doc',
        'r.documento', 'r.valor', 'r.tipo_receita', 'r.fonte_recurso',
        'r.periodo_referencia', 'r.ano', 'r.mes',
        'e.nome as entidade_nome',
      )
      .orderBy(sortCol, sortDir_)
      .limit(lim)
      .offset(off),
    baseQuery().count('* as total'),
  ]);

  const total = Number((countRows[0] as any).total);
  res.json({ rows, total, page: pg, limit: lim });
}

// ─── Resumo (cards) ───────────────────────────────────────────────────────────

export async function getReceitaSummary(req: Request, res: Response): Promise<void> {
  const { entidadeId, municipioId, ano, mes, fonte } = req.query as Record<string, string>;
  const user = (req as any).user;

  const base = () =>
    db('fact_receita as r').modify((q) => {
      if (entidadeId)  q.where('r.fk_entidade', parseInt(entidadeId));
      if (municipioId) q.where('r.fk_municipio', parseInt(municipioId));
      if (ano)         q.where('r.ano', parseInt(ano));
      if (mes)         q.where('r.mes', parseInt(mes));
      if (fonte)       q.where('r.fonte_recurso', fonte);
      applyTenantFilter(q, getTenantFilter(user), 'r.fk_entidade', 'r.fk_municipio');
    });

  const [totais, porFonte, porTipo, porMes] = await Promise.all([
    base().select(
      db.raw('COUNT(*) as total_registros'),
      db.raw('COALESCE(SUM(valor), 0) as valor_total'),
      db.raw("COALESCE(SUM(CASE WHEN tipo_receita = 'ORC'   THEN valor ELSE 0 END), 0) as valor_orc"),
      db.raw("COALESCE(SUM(CASE WHEN tipo_receita = 'EXTRA' THEN valor ELSE 0 END), 0) as valor_extra"),
    ).first(),
    base()
      .select('r.fonte_recurso')
      .count('* as registros')
      .sum('r.valor as total')
      .groupBy('r.fonte_recurso')
      .orderBy('total', 'desc'),
    base()
      .select('r.tipo_receita')
      .count('* as registros')
      .sum('r.valor as total')
      .groupBy('r.tipo_receita'),
    base()
      .select('r.mes')
      .sum('r.valor as total')
      .groupBy('r.mes')
      .orderBy('r.mes'),
  ]);

  res.json({ totais, porFonte, porTipo, porMes });
}

// ─── DRE Mensal (matriz Jan→Dez) ─────────────────────────────────────────────

export async function getReceitaDRE(req: Request, res: Response): Promise<void> {
  const { entidadeId, municipioId, ano = String(new Date().getFullYear()) } = req.query as Record<string, string>;
  const user = (req as any).user;

  const rows = await db('fact_receita as r')
    .modify((q) => {
      q.where('r.ano', parseInt(ano));
      if (entidadeId)  q.where('r.fk_entidade', parseInt(entidadeId));
      if (municipioId) q.where('r.fk_municipio', parseInt(municipioId));
      applyTenantFilter(q, getTenantFilter(user), 'r.fk_entidade', 'r.fk_municipio');
    })
    .select(
      'r.codigo_rubrica',
      db.raw('MAX(r.descricao) as descricao'),
      'r.tipo_receita',
      'r.fonte_recurso',
      'r.mes',
    )
    .sum('r.valor as total')
    .groupBy('r.codigo_rubrica', 'r.tipo_receita', 'r.fonte_recurso', 'r.mes')
    .orderBy('r.codigo_rubrica');

  res.json({ rows, ano });
}
