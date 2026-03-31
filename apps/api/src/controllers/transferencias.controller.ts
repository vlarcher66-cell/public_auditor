import { Request, Response } from 'express';
import { db } from '../config/database';

const ALLOWED_SORT = new Set([
  'data_transf', 'valor', 'conta_origem_nome', 'conta_destino_nome',
  'fonte_destino', 'num_documento', 'historico',
]);

export async function listTransferencias(req: Request, res: Response): Promise<void> {
  const page  = Math.max(1, parseInt(req.query.page  as string) || 1);
  const limit = Math.min(200, parseInt(req.query.limit as string) || 50);
  const offset = (page - 1) * limit;

  const sortBy  = ALLOWED_SORT.has(req.query.sortBy  as string) ? req.query.sortBy  as string : 'data_transf';
  const sortDir = req.query.sortDir === 'asc' ? 'asc' : 'desc';

  const user = req.user!;

  let query = db('fact_transf_bancaria as f')
    .join('dim_entidade as e', 'f.fk_entidade', 'e.id')
    .select(
      'f.id', 'f.data_transf', 'f.orgao_origem', 'f.conta_origem_codigo',
      'f.conta_origem_nome', 'f.fonte_origem', 'f.orgao_destino',
      'f.conta_destino_codigo', 'f.conta_destino_nome', 'f.fonte_destino',
      'f.num_documento', 'f.tipo_documento', 'f.valor', 'f.historico',
      'f.tipo_lancamento', 'f.periodo_referencia', 'f.ano', 'f.mes',
      'e.nome as entidade_nome',
    )
    .orderBy(`f.${sortBy}`, sortDir)
    .limit(limit)
    .offset(offset);

  let countQuery = db('fact_transf_bancaria as f').count('f.id as total');

  // RBAC
  if (user.role === 'GESTOR' && user.fk_municipio) {
    query      = query.where('f.fk_municipio', user.fk_municipio);
    countQuery = countQuery.where('f.fk_municipio', user.fk_municipio);
  } else if (user.role !== 'SUPER_ADMIN' && user.fk_entidade) {
    query      = query.where('f.fk_entidade', user.fk_entidade);
    countQuery = countQuery.where('f.fk_entidade', user.fk_entidade);
  }

  // Filtros opcionais
  if (req.query.entidadeId)    { query = query.where('f.fk_entidade', req.query.entidadeId);  countQuery = countQuery.where('f.fk_entidade', req.query.entidadeId); }
  if (req.query.municipioId)   { query = query.where('f.fk_municipio', req.query.municipioId); countQuery = countQuery.where('f.fk_municipio', req.query.municipioId); }
  if (req.query.ano)           { query = query.where('f.ano', req.query.ano);  countQuery = countQuery.where('f.ano', req.query.ano); }
  if (req.query.mes)           { query = query.where('f.mes', req.query.mes);  countQuery = countQuery.where('f.mes', req.query.mes); }
  if (req.query.fonteDest)     { query = query.where('f.fonte_destino', req.query.fonteDest);   countQuery = countQuery.where('f.fonte_destino', req.query.fonteDest); }
  if (req.query.tipoDoc)       { query = query.where('f.tipo_documento', req.query.tipoDoc);    countQuery = countQuery.where('f.tipo_documento', req.query.tipoDoc); }
  if (req.query.dataInicio)    { query = query.where('f.data_transf', '>=', req.query.dataInicio); countQuery = countQuery.where('f.data_transf', '>=', req.query.dataInicio); }
  if (req.query.dataFim)       { query = query.where('f.data_transf', '<=', req.query.dataFim);    countQuery = countQuery.where('f.data_transf', '<=', req.query.dataFim); }
  if (req.query.historico) {
    const term = `%${req.query.historico}%`;
    query      = query.where('f.historico', 'like', term);
    countQuery = countQuery.where('f.historico', 'like', term);
  }
  if (req.query.valorMin) { query = query.where('f.valor', '>=', req.query.valorMin); countQuery = countQuery.where('f.valor', '>=', req.query.valorMin); }
  if (req.query.valorMax) { query = query.where('f.valor', '<=', req.query.valorMax); countQuery = countQuery.where('f.valor', '<=', req.query.valorMax); }

  const [rows, countRows] = await Promise.all([query, countQuery]);
  const total = Number((countRows[0] as any).total);

  res.json({ rows, total, page, limit });
}

export async function getTransferenciaDRE(req: Request, res: Response): Promise<void> {
  const { entidadeId, municipioId, ano = String(new Date().getFullYear()) } = req.query as Record<string, string>;
  const user = req.user!;

  const rows = await db('fact_transf_bancaria as f')
    .modify((q) => {
      q.where('f.ano', parseInt(ano));
      if (entidadeId)  q.where('f.fk_entidade', parseInt(entidadeId));
      if (municipioId) q.where('f.fk_municipio', parseInt(municipioId));
      if (user.role === 'GESTOR' && user.fk_municipio) q.where('f.fk_municipio', user.fk_municipio);
      else if (user.role !== 'SUPER_ADMIN' && user.fk_entidade) q.where('f.fk_entidade', user.fk_entidade);
    })
    .select(
      'f.tipo_lancamento',
      'f.conta_origem_nome',
      'f.fonte_origem',
      'f.mes',
    )
    .sum('f.valor as total')
    .groupBy('f.tipo_lancamento', 'f.conta_origem_nome', 'f.fonte_origem', 'f.mes')
    .orderBy('f.tipo_lancamento');

  res.json({ rows, ano });
}

export async function getTransferenciaSummary(req: Request, res: Response): Promise<void> {
  const user = req.user!;

  let base = db('fact_transf_bancaria as f');

  if (user.role === 'GESTOR' && user.fk_municipio) {
    base = base.where('f.fk_municipio', user.fk_municipio);
  } else if (user.role !== 'SUPER_ADMIN' && user.fk_entidade) {
    base = base.where('f.fk_entidade', user.fk_entidade);
  }

  if (req.query.entidadeId)  base = base.where('f.fk_entidade',  req.query.entidadeId);
  if (req.query.municipioId) base = base.where('f.fk_municipio', req.query.municipioId);
  if (req.query.ano)         base = base.where('f.ano', req.query.ano);
  if (req.query.mes)         base = base.where('f.mes', req.query.mes);

  const [totais, porFonte, porTipoDoc] = await Promise.all([
    base.clone().select(
      db.raw('COUNT(*) as total_registros'),
      db.raw('SUM(f.valor) as valor_total'),
    ).first(),

    base.clone()
      .groupBy('f.fonte_destino')
      .select('f.fonte_destino', db.raw('COUNT(*) as registros'), db.raw('SUM(f.valor) as total'))
      .orderBy('total', 'desc'),

    base.clone()
      .groupBy('f.tipo_documento')
      .select('f.tipo_documento', db.raw('COUNT(*) as registros'), db.raw('SUM(f.valor) as total'))
      .orderBy('total', 'desc'),
  ]);

  res.json({
    total_registros: Number((totais as any)?.total_registros ?? 0),
    valor_total:     parseFloat((totais as any)?.valor_total ?? 0),
    porFonte,
    porTipoDoc,
  });
}
