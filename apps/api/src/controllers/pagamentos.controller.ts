import { Request, Response } from 'express';
import * as XLSX from 'xlsx';
import { db } from '../config/database';
import { isSuperAdmin } from '../config/roles';
import { getTenantFilter, applyTenantFilter } from '../middleware/auth.middleware';

export async function listPagamentos(req: Request, res: Response): Promise<void> {
  const {
    dataInicio, dataFim, dataLiqInicio, dataLiqFim,
    credorId, credorSearch, entidadeId,
    elementoDespesa, fonteRecurso, tipoEmpenho, numEmpenho, numProcesso,
    grupoId, subgrupoId, setorId, tipoRelatorio,
    valorBrutoMin, valorBrutoMax,
    valorRetidoMin, valorRetidoMax,
    valorLiquidoMin, valorLiquidoMax,
    semSetor, semGrupo, semSubgrupo,
    page = '1', limit = '50',
    sortBy = 'data_pagamento', sortDir = 'desc',
  } = req.query as Record<string, string>;

  const pg = Math.max(1, parseInt(page));
  const lim = Math.min(200, parseInt(limit));
  const offset = (pg - 1) * lim;

  const baseQuery = () =>
    db('fact_ordem_pagamento as f')
      .join('dim_entidade as e', 'f.fk_entidade', 'e.id')
      .leftJoin('dim_credor as c', 'f.fk_credor', 'c.id')
      .leftJoin('dim_grupo_despesa as gd', 'c.fk_grupo', 'gd.id')
      .leftJoin('dim_subgrupo_despesa as sd', 'c.fk_subgrupo', 'sd.id')
      .leftJoin('dim_grupo_despesa as gdp', 'f.fk_grupo_pag', 'gdp.id')
      .leftJoin('dim_subgrupo_despesa as sdp', 'f.fk_subgrupo_pag', 'sdp.id')
      .leftJoin('dim_regra_empenho as re', function () {
        this.on('re.fk_credor', 'f.fk_credor').andOn('re.num_empenho_base', 'f.num_empenho_base');
      })
      .leftJoin('dim_grupo_despesa as gdr', 're.fk_grupo', 'gdr.id')
      .leftJoin('dim_subgrupo_despesa as sdr', 're.fk_subgrupo', 'sdr.id')
      .join('dim_tipo_empenho as te', 'f.fk_tipo_empenho', 'te.id')
      .join('dim_elemento_despesa as el', 'f.fk_elemento_despesa', 'el.id')
      .join('dim_fonte_recurso as fr', 'f.fk_fonte_recurso', 'fr.id')
      .join('dim_periodo as p', 'f.fk_periodo', 'p.id')
      .join('dim_acao as a', 'f.fk_acao', 'a.id')
      .join('dim_unidade_orcamentaria as uo', 'f.fk_unidade_orc', 'uo.id')
      .leftJoin('dim_setor as st', 'f.fk_setor_pag', 'st.id')
      .modify((q) => {
        // Tenant isolation
        const tf = getTenantFilter(req.user!);
        applyTenantFilter(q, tf, 'f.fk_entidade', 'f.fk_municipio');

        if (dataInicio) q.where('f.data_pagamento', '>=', dataInicio);
        if (dataFim) q.where('f.data_pagamento', '<=', dataFim);
        if (dataLiqInicio) q.where('f.data_liquidacao', '>=', dataLiqInicio);
        if (dataLiqFim) q.where('f.data_liquidacao', '<=', dataLiqFim);
        if (credorId) q.where('f.fk_credor', credorId);
        if (credorSearch) q.where((w) => w
          .where('c.nome', 'ilike', `%${credorSearch}%`)
          .orWhere('c.cnpj_cpf', 'ilike', `%${credorSearch}%`)
          .orWhere('f.credor_nome', 'ilike', `%${credorSearch}%`)
          .orWhere('f.credor_cnpj_cpf', 'ilike', `%${credorSearch}%`));
        if (entidadeId) q.where('f.fk_entidade', entidadeId);
        if (elementoDespesa) q.where('el.codigo', 'like', `%${elementoDespesa}%`);
        if (fonteRecurso) q.where('fr.codigo', fonteRecurso);
        if (tipoEmpenho) q.where('te.descricao', tipoEmpenho);
        if (numEmpenho) q.where('f.num_empenho', 'like', `%${numEmpenho}%`);
        if (numProcesso) q.where('f.num_processo', 'like', `%${numProcesso}%`);
        // Filtro de grupo: usa classificação por pagamento quando disponível, senão usa do credor
        if (grupoId) q.where(db.raw('COALESCE(f.fk_grupo_pag, c.fk_grupo)') as any, grupoId);
        if (subgrupoId) q.where(db.raw('COALESCE(f.fk_subgrupo_pag, c.fk_subgrupo)') as any, subgrupoId);
        if (tipoRelatorio) q.where('f.tipo_relatorio', tipoRelatorio);
        if (setorId) q.where('f.fk_setor_pag', setorId);
        if (semSetor === '1') q.whereNull('f.fk_setor_pag');
        if (semGrupo === '1') q.whereNull(db.raw('COALESCE(f.fk_grupo_pag, c.fk_grupo)') as any);
        if (semSubgrupo === '1') q.whereNull(db.raw('COALESCE(f.fk_subgrupo_pag, c.fk_subgrupo)') as any);
        if (valorBrutoMin) q.where('f.valor_bruto', '>=', parseFloat(valorBrutoMin));
        if (valorBrutoMax) q.where('f.valor_bruto', '<=', parseFloat(valorBrutoMax));
        if (valorRetidoMin) q.where('f.valor_retido', '>=', parseFloat(valorRetidoMin));
        if (valorRetidoMax) q.where('f.valor_retido', '<=', parseFloat(valorRetidoMax));
        if (valorLiquidoMin) q.where('f.valor_liquido', '>=', parseFloat(valorLiquidoMin));
        if (valorLiquidoMax) q.where('f.valor_liquido', '<=', parseFloat(valorLiquidoMax));
      });

  const allowedSortCols: Record<string, string> = {
    tipo_relatorio: 'f.tipo_relatorio',
    data_pagamento: 'f.data_pagamento',
    data_liquidacao: 'f.data_liquidacao',
    num_empenho: 'f.num_empenho',
    credor: 'c.nome',
    historico: 'f.historico',
    valor_bruto: 'f.valor_bruto',
    valor_liquido: 'f.valor_liquido',
    setor: 'st.descricao',
  };
  const sortCol = allowedSortCols[sortBy] || 'f.data_pagamento';
  const sortDirection = sortDir === 'asc' ? 'asc' : 'desc';

  const [rows, [{ total }]] = await Promise.all([
    baseQuery()
      .select(
        'f.id', 'f.num_empenho', 'f.num_empenho_base', 'f.reduzido', 'f.num_processo', 'f.historico',
        'f.tipo_relatorio',
        'f.data_pagamento', 'f.data_empenho', 'f.data_liquidacao',
        'f.valor_bruto', 'f.valor_retido', 'f.valor_liquido', 'f.valor_pessoal',
        'f.sub_elemento',
        'f.fk_setor_pag', 'st.descricao as setor_nome',
        'e.nome as entidade_nome', 'e.cnpj as entidade_cnpj',
        db.raw('COALESCE(c.nome, f.credor_nome) as credor_nome'),
        db.raw('COALESCE(c.cnpj_cpf, f.credor_cnpj_cpf) as credor_cnpj'),
        'f.fk_credor', 'c.detalhar_no_pagamento',
        'f.fk_grupo_pag', 'f.fk_subgrupo_pag',
        're.id as regra_empenho_id', 're.fk_grupo as regra_fk_grupo', 're.fk_subgrupo as regra_fk_subgrupo',
        'gd.nome as grupo_nome', 'sd.nome as subgrupo_nome',
        'gdp.nome as grupo_pag_nome', 'sdp.nome as subgrupo_pag_nome',
        'gdr.nome as grupo_regra_nome', 'sdr.nome as subgrupo_regra_nome',
        'te.descricao as tipo_empenho',
        'el.codigo as elemento_despesa',
        'fr.codigo as fonte_recurso',
        'a.codigo as acao',
        'uo.codigo as unidade_orcamentaria',
        'p.data_inicio as periodo_inicio', 'p.data_fim as periodo_fim',
        db.raw('CASE WHEN f.rateio_itens IS NOT NULL THEN 1 ELSE 0 END as has_rateio'),
      )
      .orderBy(sortCol, sortDirection)
      .limit(lim)
      .offset(offset),
    baseQuery().count('f.id as total'),
  ]);

  res.json({ rows, total: Number(total), page: pg, limit: lim });
}

export async function backfillEmpenhoBase(_req: Request, res: Response): Promise<void> {
  const result = await db.raw("UPDATE fact_ordem_pagamento SET num_empenho_base = TRIM(SPLIT_PART(num_empenho, '/', 1)) WHERE num_empenho_base IS NULL OR num_empenho_base = ''");
  res.json({ updated: result.rowCount });
}

export async function backfillSubgrupoPrefixado(_req: Request, res: Response): Promise<void> {
  // Busca todos os pagamentos DEA ou RP sem fk_subgrupo_pag, que têm credor com subgrupo
  const pagamentos = await db('fact_ordem_pagamento as f')
    .leftJoin('dim_credor as c', 'f.fk_credor', 'c.id')
    .leftJoin('dim_subgrupo_despesa as s', 'c.fk_subgrupo', 's.id')
    .whereIn('f.fk_grupo_pag', Object.keys(GRUPOS_COM_PREFIXO).map(Number))
    .whereNull('f.fk_subgrupo_pag')
    .whereNotNull('s.id')
    .select('f.id', 'f.fk_grupo_pag', 's.nome as subgrupo_nome');

  let updated = 0;
  for (const pag of pagamentos) {
    const prefixo = GRUPOS_COM_PREFIXO[Number(pag.fk_grupo_pag)];
    if (!prefixo || !pag.subgrupo_nome) continue;

    const nomeComPrefixo = `${prefixo} - ${pag.subgrupo_nome}`;
    let subgrupo = await db('dim_subgrupo_despesa')
      .where({ nome: nomeComPrefixo, fk_grupo: pag.fk_grupo_pag })
      .first();

    if (!subgrupo) {
      const [{ id: novoId }] = await db('dim_subgrupo_despesa').insert({
        nome: nomeComPrefixo,
        fk_grupo: pag.fk_grupo_pag,
      }).returning('id');
      subgrupo = { id: novoId };
    }

    await db('fact_ordem_pagamento').where({ id: pag.id }).update({ fk_subgrupo_pag: subgrupo.id });
    updated++;
  }

  res.json({ updated });
}

export async function autoClassificarDiarias(_req: Request, res: Response): Promise<void> {
  // Busca pagamentos com elemento 3.3.90.14 que ainda não têm fk_grupo_pag definido
  const pagamentos = await db('fact_ordem_pagamento as f')
    .join('dim_elemento_despesa as el', 'f.fk_elemento_despesa', 'el.id')
    .whereNull('f.fk_grupo_pag')
    .where('el.codigo', 'like', '3.3.90.14%')
    .select('f.id');

  if (pagamentos.length === 0) {
    res.json({ updated: 0 });
    return;
  }

  const ids = pagamentos.map((p: any) => p.id);
  const updated = await db('fact_ordem_pagamento')
    .whereIn('id', ids)
    .update({ fk_grupo_pag: GRUPO_DIARIAS_ID });

  res.json({ updated });
}

// IDs dos grupos especiais que herdam subgrupo do credor com prefixo
const GRUPOS_COM_PREFIXO: Record<number, string> = {
  23: 'DEA',
  22: 'RP',
};

const GRUPO_DIARIAS_ID = 8;

async function resolverSubgrupoPrefixado(grupoId: number, pagamentoId: string): Promise<number | null> {
  const prefixo = GRUPOS_COM_PREFIXO[grupoId];
  if (!prefixo) return null;

  // Busca o subgrupo do credor vinculado ao pagamento
  const pag = await db('fact_ordem_pagamento as f')
    .leftJoin('dim_credor as c', 'f.fk_credor', 'c.id')
    .leftJoin('dim_subgrupo_despesa as s', 'c.fk_subgrupo', 's.id')
    .where('f.id', pagamentoId)
    .select('s.id as subgrupo_id', 's.nome as subgrupo_nome')
    .first();

  if (!pag?.subgrupo_nome) return null;

  const nomeComPrefixo = `${prefixo} - ${pag.subgrupo_nome}`;

  // Find-or-create do subgrupo prefixado dentro do grupo DEA/RP
  let subgrupo = await db('dim_subgrupo_despesa')
    .where({ nome: nomeComPrefixo, fk_grupo: grupoId })
    .first();

  if (!subgrupo) {
    const [{ id: novoId }] = await db('dim_subgrupo_despesa').insert({
      nome: nomeComPrefixo,
      fk_grupo: grupoId,
    }).returning('id');
    return novoId;
  }

  return subgrupo.id;
}

export async function classificarPagamento(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { fk_grupo_pag, fk_subgrupo_pag, fk_setor_pag } = req.body;
  const update: Record<string, any> = {};

  if ('fk_grupo_pag' in req.body) update.fk_grupo_pag = fk_grupo_pag || null;
  if ('fk_setor_pag' in req.body) update.fk_setor_pag = fk_setor_pag || null;

  // Se o grupo é DEA ou RP e o usuário não enviou um subgrupo manual,
  // resolve automaticamente o subgrupo prefixado a partir do credor
  if ('fk_subgrupo_pag' in req.body && fk_subgrupo_pag) {
    update.fk_subgrupo_pag = fk_subgrupo_pag;
  } else if (fk_grupo_pag && GRUPOS_COM_PREFIXO[Number(fk_grupo_pag)]) {
    update.fk_subgrupo_pag = await resolverSubgrupoPrefixado(Number(fk_grupo_pag), String(id));
  } else if ('fk_subgrupo_pag' in req.body) {
    update.fk_subgrupo_pag = fk_subgrupo_pag || null;
  }

  await db('fact_ordem_pagamento').where({ id }).update(update);
  res.json({ message: 'Classificação salva' });
}

export async function autoClassificarSetores(req: Request, res: Response): Promise<void> {
  try {
    // Busca todos os setores que têm palavras-chave ou descrição
    const setores = await db('dim_setor')
      .select('id', 'descricao', 'palavras_chave')
      .whereNotNull('id');

    // Busca todos os pagamentos sem setor ainda (ou reprocessa todos se ?force=true)
    const force = req.query.force === 'true';
    const pagamentos = await db('fact_ordem_pagamento')
      .select('id', 'historico')
      .modify((q) => { if (!force) q.whereNull('fk_setor_pag'); })
      .whereNotNull('historico');

    // Normaliza texto: remove acentos e caracteres especiais para comparação
    function normalizar(s: string): string {
      return s.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    }

    // Verifica se o termo aparece como palavra inteira no histórico (evita "UBS" bater em "SUBSIDIO")
    function matchPalavraInteira(historico: string, termo: string): boolean {
      // Termos com mais de 4 chars: aceita substring (são específicos o suficiente)
      // Termos com até 4 chars (siglas curtas): exige palavra inteira (delimitada por espaço/início/fim)
      if (termo.length > 4) return historico.includes(termo);
      const re = new RegExp(`(?<![A-Z0-9])${termo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Z0-9])`);
      return re.test(historico);
    }

    // Monta lista de termos por setor: { id, terms: string[] }
    const setoresComTermos = setores
      .map((s: any) => {
        const terms: string[] = [normalizar(s.descricao)];
        if (s.palavras_chave) {
          s.palavras_chave.split(',').forEach((kw: string) => {
            const t = normalizar(kw);
            if (t) terms.push(t);
          });
        }
        return { id: s.id, terms };
      })
      // Ordena por comprimento do termo mais longo (match mais específico primeiro)
      .sort((a: any, b: any) => Math.max(...b.terms.map((t: string) => t.length)) - Math.max(...a.terms.map((t: string) => t.length)));

    let updated = 0;
    let skipped = 0;

    // Processa em lote de 500
    const BATCH = 500;
    for (let i = 0; i < pagamentos.length; i += BATCH) {
      const batch = pagamentos.slice(i, i + BATCH);
      const updates: { id: number; fk_setor_pag: number }[] = [];

      for (const pag of batch) {
        if (!pag.historico) { skipped++; continue; }
        const h = normalizar(pag.historico);

        let matched: number | null = null;
        for (const s of setoresComTermos) {
          if (s.terms.some((t: string) => matchPalavraInteira(h, t))) {
            matched = s.id;
            break;
          }
        }

        if (matched) {
          updates.push({ id: pag.id, fk_setor_pag: matched });
        } else {
          skipped++;
        }
      }

      // Atualiza cada pagamento matched
      for (const u of updates) {
        await db('fact_ordem_pagamento').where({ id: u.id }).update({ fk_setor_pag: u.fk_setor_pag });
        updated++;
      }
    }

    res.json({
      ok: true,
      total_processados: pagamentos.length,
      atualizados: updated,
      sem_match: skipped,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? 'Erro ao auto-classificar' });
  }
}

export async function getPorSetor(req: Request, res: Response): Promise<void> {
  const { ano, entidadeId } = req.query as Record<string, string>;
  const anoFiltro = ano || new Date().getFullYear().toString();
  const tf = getTenantFilter(req.user!);

  const rows = await db('fact_ordem_pagamento as f')
    .join('dim_setor as st', 'f.fk_setor_pag', 'st.id')
    .modify((q: any) => {
      q.whereRaw('EXTRACT(YEAR FROM f.data_pagamento) = ?', [anoFiltro]);
      applyTenantFilter(q, tf, 'f.fk_entidade', 'f.fk_municipio');
      if (entidadeId) q.where('f.fk_entidade', entidadeId);
    })
    .select(
      'st.id',
      'st.descricao as nome',
      db.raw('SUM(f.valor_bruto) as total'),
      db.raw('COUNT(*) as qtd'),
    )
    .groupBy('st.id', 'st.descricao')
    .orderBy('total', 'desc')
    .limit(20);

  const totalGeral = rows.reduce((s: number, r: any) => s + Number(r.total), 0);

  res.json(rows.map((r: any) => ({
    id: r.id,
    nome: r.nome,
    total: Number(r.total),
    qtd: Number(r.qtd),
    pct: totalGeral > 0 ? (Number(r.total) / totalGeral) * 100 : 0,
  })));
}

export async function getSummary(req: Request, res: Response): Promise<void> {
  const { dataInicio, dataFim, entidadeId, ano } = req.query as Record<string, string>;
  const tf = getTenantFilter(req.user!);

  const baseFilter = (q: any) => {
    applyTenantFilter(q, tf, 'f.fk_entidade', 'f.fk_municipio');
    if (ano) q.whereRaw('EXTRACT(YEAR FROM f.data_pagamento) = ?', [parseInt(ano)]);
    if (dataInicio) q.where('f.data_pagamento', '>=', dataInicio);
    if (dataFim) q.where('f.data_pagamento', '<=', dataFim);
    if (entidadeId) q.where('f.fk_entidade', entidadeId);
  };

  const [totais, topCredores, byElemento, byFonte, porMes] = await Promise.all([
    db('fact_ordem_pagamento as f')
      .modify(baseFilter)
      .select(
        db.raw('SUM(valor_bruto) as "totalBruto"'),
        db.raw('SUM(valor_retido) as "totalRetido"'),
        db.raw('SUM(valor_liquido) as "totalLiquido"'),
        db.raw('COUNT(*) as "countRegistros"'),
      )
      .first(),

    db('fact_ordem_pagamento as f')
      .join('dim_credor as c', 'f.fk_credor', 'c.id')
      .modify(baseFilter)
      .select('c.nome as nome', db.raw('SUM(f.valor_liquido) as total'))
      .groupBy('c.id', 'c.nome')
      .orderBy('total', 'desc'),

    db('fact_ordem_pagamento as f')
      .join('dim_elemento_despesa as el', 'f.fk_elemento_despesa', 'el.id')
      .modify(baseFilter)
      .select('el.codigo as codigo', db.raw('SUM(f.valor_liquido) as total'))
      .groupBy('el.id', 'el.codigo')
      .orderBy('total', 'desc')
      .limit(10),

    db('fact_ordem_pagamento as f')
      .join('dim_fonte_recurso as fr', 'f.fk_fonte_recurso', 'fr.id')
      .modify(baseFilter)
      .select('fr.codigo as codigo', db.raw('SUM(f.valor_liquido) as total'))
      .groupBy('fr.id', 'fr.codigo')
      .orderBy('total', 'desc')
      .limit(10),

    db('fact_ordem_pagamento as f')
      .modify(baseFilter)
      .select(db.raw('EXTRACT(MONTH FROM f.data_pagamento) as mes'))
      .sum('f.valor_bruto as total')
      .groupByRaw('EXTRACT(MONTH FROM f.data_pagamento)')
      .orderByRaw('EXTRACT(MONTH FROM f.data_pagamento)'),
  ]);

  res.json({
    totalBruto: Number(totais?.totalBruto || 0),
    totalRetido: Number(totais?.totalRetido || 0),
    totalLiquido: Number(totais?.totalLiquido || 0),
    countRegistros: Number(totais?.countRegistros || 0),
    topCredores,
    byElementoDespesa: byElemento,
    byFonteRecurso: byFonte,
    porMes,
  });
}

/** Helper: aplica os filtros da sintetica em qualquer query sobre fact_ordem_pagamento */
function applyFiltrosSintetica(q: any, p: {
  anoFiltro: string;
  entidadeId?: string;
  secretariaId?: string;
  setorId?: string;
  blocoId?: string;
  fonteRecurso?: string;
  grupoId?: string;
  subgrupoId?: string;
  tenantFilter?: ReturnType<typeof getTenantFilter>;
}) {
  q.whereRaw('EXTRACT(YEAR FROM f.data_pagamento) = ?', [p.anoFiltro]);
  // Tenant isolation
  if (p.tenantFilter) applyTenantFilter(q, p.tenantFilter, 'f.fk_entidade', 'f.fk_municipio');
  if (p.entidadeId)   q.where('f.fk_entidade', p.entidadeId);
  if (p.secretariaId) q.where('st.fk_secretaria', p.secretariaId);
  if (p.setorId)      q.where('f.fk_setor_pag', p.setorId);
  if (p.blocoId)      q.where('st.fk_bloco', p.blocoId);
  if (p.fonteRecurso) q.where('fr.codigo', p.fonteRecurso);
  if (p.grupoId)      q.where(db.raw('COALESCE(f.fk_grupo_pag, c.fk_grupo)') as any, p.grupoId);
  if (p.subgrupoId)   q.where(db.raw('COALESCE(f.fk_subgrupo_pag, c.fk_subgrupo)') as any, p.subgrupoId);
}

export async function getSinteticaMensal(req: Request, res: Response): Promise<void> {
  const { ano, entidadeId, secretariaId, setorId, blocoId, fonteRecurso, grupoId, subgrupoId } = req.query as Record<string, string>;
  const anoFiltro = ano || new Date().getFullYear().toString();
  const tenantFilter = getTenantFilter(req.user!);
  const filtrosBase = { anoFiltro, entidadeId, secretariaId, setorId, blocoId, fonteRecurso, tenantFilter };
  const filtrosSemRateio = { ...filtrosBase, grupoId, subgrupoId };

  const baseJoins = (q: any) => q
    .leftJoin('dim_credor as c', 'f.fk_credor', 'c.id')
    .leftJoin('dim_setor as st', 'f.fk_setor_pag', 'st.id')
    .join('dim_fonte_recurso as fr', 'f.fk_fonte_recurso', 'fr.id');

  const [grupos, linhasSemRateio, pagamentosComRateio] = await Promise.all([
    db('dim_grupo_despesa').select('id', 'nome').orderBy('nome'),

    // Pagamentos SEM rateio: agrupa pelo grupo do pagamento/credor
    baseJoins(db('fact_ordem_pagamento as f'))
      .modify((q: any) => applyFiltrosSintetica(q, filtrosSemRateio))
      .whereNull('f.rateio_itens')
      .whereNotNull(db.raw('COALESCE(f.fk_grupo_pag, c.fk_grupo)') as any)
      .select(
        db.raw('COALESCE(f.fk_grupo_pag, c.fk_grupo) as grupo_id'),
        db.raw('EXTRACT(MONTH FROM f.data_pagamento) as mes'),
        db.raw('SUM(f.valor_bruto) as total'),
      )
      .groupByRaw('COALESCE(f.fk_grupo_pag, c.fk_grupo), EXTRACT(MONTH FROM f.data_pagamento)'),

    // Pagamentos COM rateio: traz o JSON para expandir em memória
    baseJoins(db('fact_ordem_pagamento as f'))
      .modify((q: any) => applyFiltrosSintetica(q, filtrosBase))
      .whereNotNull('f.rateio_itens')
      .select(
        db.raw('EXTRACT(MONTH FROM f.data_pagamento) as mes'),
        'f.rateio_itens',
      ),
  ]);

  // Monta matriz: { [grupo_id]: { [mes]: total } }
  const matrix: Record<number, Record<number, number>> = {};

  // 1) Sem rateio — direto do banco
  for (const row of linhasSemRateio) {
    const gId = Number(row.grupo_id);
    const mes = Number(row.mes);
    if (!matrix[gId]) matrix[gId] = {};
    matrix[gId][mes] = (matrix[gId][mes] || 0) + Number(row.total);
  }

  // 2) Com rateio — expande JSON em memória
  for (const row of pagamentosComRateio) {
    const mes = Number(row.mes);
    let itens: { fk_grupo: number | null; fk_subgrupo?: number | null; valor: number }[] = [];
    try { itens = JSON.parse(String(row.rateio_itens)); } catch { continue; }
    for (const item of itens) {
      if (!item.fk_grupo || Number(item.valor) <= 0) continue;
      if (grupoId && Number(item.fk_grupo) !== Number(grupoId)) continue;
      if (subgrupoId && Number(item.fk_subgrupo) !== Number(subgrupoId)) continue;
      const gId = Number(item.fk_grupo);
      if (!matrix[gId]) matrix[gId] = {};
      matrix[gId][mes] = (matrix[gId][mes] || 0) + Number(item.valor);
    }
  }

  const totaisMes: Record<number, number> = {};
  if (grupoId || subgrupoId) {
    for (const meses of Object.values(matrix)) {
      for (const [mesStr, total] of Object.entries(meses)) {
        const mes = Number(mesStr);
        totaisMes[mes] = (totaisMes[mes] || 0) + Number(total);
      }
    }
  } else {
    const totalPorMes = await baseJoins(db('fact_ordem_pagamento as f'))
      .modify((q: any) => applyFiltrosSintetica(q, filtrosBase))
      .select(db.raw('EXTRACT(MONTH FROM f.data_pagamento) as mes'), db.raw('SUM(f.valor_bruto) as total'))
      .groupByRaw('EXTRACT(MONTH FROM f.data_pagamento)');
    for (const r of totalPorMes) totaisMes[Number(r.mes)] = Number(r.total);
  }

  // Identifica grupos de exercícios anteriores pelo nome (RESTOS A PAGAR e DESPESAS DO EXERCÍCIO ANTERIOR)
  const gruposExAntDef = await db('dim_grupo_despesa')
    .whereRaw("UPPER(nome) LIKE '%RESTOS A PAGAR%' OR UPPER(nome) LIKE '%EXERC%CIO ANTERIOR%'")
    .select('id');
  const idsExAntSet = new Set(gruposExAntDef.map((r: any) => Number(r.id)));
  const idsExAnt = [...idsExAntSet];

  // Totalizador "Outros Exercícios": soma da matrix dos grupos identificados por nome (RP + DEA)
  const totaisExAnt: Record<number, number> = {};
  for (const gId of idsExAntSet) {
    const meses = matrix[gId];
    if (!meses) continue;
    for (const [mes, total] of Object.entries(meses)) {
      const m = Number(mes);
      totaisExAnt[m] = (totaisExAnt[m] || 0) + Number(total);
    }
  }

  res.json({ grupos, matrix, totaisMes, totaisExAnt, idsExAnt, ano: anoFiltro });
}

export async function getAnaliticaMensal(req: Request, res: Response): Promise<void> {
  const { ano, entidadeId, secretariaId, setorId, blocoId, fonteRecurso, grupoId, subgrupoId } = req.query as Record<string, string>;
  const anoFiltro = ano || new Date().getFullYear().toString();
  const tenantFilter = getTenantFilter(req.user!);
  const filtrosBase = { anoFiltro, entidadeId, secretariaId, setorId, blocoId, fonteRecurso, tenantFilter };
  const filtrosSemRateio = { ...filtrosBase, grupoId, subgrupoId };

  const baseJoins = (q: any) => q
    .leftJoin('dim_credor as c', 'f.fk_credor', 'c.id')
    .leftJoin('dim_setor as st', 'f.fk_setor_pag', 'st.id')
    .join('dim_fonte_recurso as fr', 'f.fk_fonte_recurso', 'fr.id');

  const [grupos, subgrupos, linhasSemRateio, pagamentosComRateio] = await Promise.all([
    db('dim_grupo_despesa').select('id', 'nome')
      .orderByRaw('CASE WHEN id IN (22, 23) THEN 1 ELSE 0 END, nome'),
    db('dim_subgrupo_despesa').select('id', 'nome', 'fk_grupo')
      .orderByRaw('CASE WHEN fk_grupo IN (22, 23) THEN 1 ELSE 0 END, nome'),

    // Pagamentos SEM rateio — agrupa por grupo + subgrupo + mês
    baseJoins(db('fact_ordem_pagamento as f'))
      .modify((q: any) => applyFiltrosSintetica(q, filtrosSemRateio))
      .whereNull('f.rateio_itens')
      .whereNotNull(db.raw('COALESCE(f.fk_grupo_pag, c.fk_grupo)') as any)
      .select(
        db.raw('COALESCE(f.fk_grupo_pag, c.fk_grupo) as grupo_id'),
        db.raw('COALESCE(f.fk_subgrupo_pag, c.fk_subgrupo) as subgrupo_id'),
        db.raw('EXTRACT(MONTH FROM f.data_pagamento) as mes'),
        db.raw('SUM(f.valor_bruto) as total'),
      )
      .groupByRaw('COALESCE(f.fk_grupo_pag, c.fk_grupo), COALESCE(f.fk_subgrupo_pag, c.fk_subgrupo), EXTRACT(MONTH FROM f.data_pagamento)'),

    // Pagamentos COM rateio — expande JSON em memória
    baseJoins(db('fact_ordem_pagamento as f'))
      .modify((q: any) => applyFiltrosSintetica(q, filtrosBase))
      .whereNotNull('f.rateio_itens')
      .select(db.raw('EXTRACT(MONTH FROM f.data_pagamento) as mes'), 'f.rateio_itens'),
  ]);

  // matrix: { [grupo_id]: { [subgrupo_id | 0]: { [mes]: total } } }
  // subgrupo_id = 0 significa "sem subgrupo"
  const matrix: Record<number, Record<number, Record<number, number>>> = {};

  const addToMatrix = (gId: number, sId: number, mes: number, valor: number) => {
    if (!matrix[gId]) matrix[gId] = {};
    if (!matrix[gId][sId]) matrix[gId][sId] = {};
    matrix[gId][sId][mes] = (matrix[gId][sId][mes] || 0) + valor;
  };

  for (const row of linhasSemRateio) {
    addToMatrix(Number(row.grupo_id), Number(row.subgrupo_id) || 0, Number(row.mes), Number(row.total));
  }

  for (const row of pagamentosComRateio) {
    const mes = Number(row.mes);
    let itens: { fk_grupo: number | null; fk_subgrupo: number | null; valor: number }[] = [];
    try { itens = JSON.parse(String(row.rateio_itens)); } catch { continue; }
    for (const item of itens) {
      if (!item.fk_grupo || Number(item.valor) <= 0) continue;
      if (grupoId && Number(item.fk_grupo) !== Number(grupoId)) continue;
      if (subgrupoId && Number(item.fk_subgrupo) !== Number(subgrupoId)) continue;
      addToMatrix(Number(item.fk_grupo), Number(item.fk_subgrupo) || 0, mes, Number(item.valor));
    }
  }

  // Calcula totalizadores por mês
  const GRUPOS_EXANT = new Set([22, 23]); // RP e DEA
  const totaisMes: Record<number, number> = {};
  const totaisExAnt: Record<number, number> = {};

  for (const [gIdStr, subgrupos] of Object.entries(matrix)) {
    const gId = Number(gIdStr);
    for (const meses of Object.values(subgrupos)) {
      for (const [mesStr, valor] of Object.entries(meses)) {
        const mes = Number(mesStr);
        totaisMes[mes] = (totaisMes[mes] || 0) + valor;
        if (GRUPOS_EXANT.has(gId)) {
          totaisExAnt[mes] = (totaisExAnt[mes] || 0) + valor;
        }
      }
    }
  }

  res.json({ grupos, subgrupos, matrix, totaisMes, totaisExAnt, idsExAnt: [22, 23], ano: anoFiltro });
}

// IDs dos grupos de Outros Exercícios
const GRUPOS_EX_ANT = [22, 23]; // RP = 22, DEA = 23

export async function getOutrosExercicios(req: Request, res: Response): Promise<void> {
  const { ano, entidadeId, secretariaId, setorId, blocoId, fonteRecurso } = req.query as Record<string, string>;
  const anoFiltro = ano || new Date().getFullYear().toString();
  const filtros = { anoFiltro, entidadeId, secretariaId, setorId, blocoId, fonteRecurso };

  const baseJoins = (q: any) => q
    .leftJoin('dim_credor as c', 'f.fk_credor', 'c.id')
    .leftJoin('dim_setor as st', 'f.fk_setor_pag', 'st.id')
    .join('dim_fonte_recurso as fr', 'f.fk_fonte_recurso', 'fr.id');

  const [grupos, subgrupos, porMes, porSubgrupo, porCredor, porSetor] = await Promise.all([
    // Grupos DEA e RP
    db('dim_grupo_despesa').whereIn('id', GRUPOS_EX_ANT).select('id', 'nome').orderBy('nome'),

    // Subgrupos desses grupos
    db('dim_subgrupo_despesa').whereIn('fk_grupo', GRUPOS_EX_ANT).select('id', 'nome', 'fk_grupo').orderBy('nome'),

    // Total por grupo + mês
    baseJoins(db('fact_ordem_pagamento as f'))
      .modify((q: any) => applyFiltrosSintetica(q, filtros))
      .whereNull('f.rateio_itens')
      .whereIn(db.raw('COALESCE(f.fk_grupo_pag, c.fk_grupo)') as any, GRUPOS_EX_ANT)
      .select(
        db.raw('COALESCE(f.fk_grupo_pag, c.fk_grupo) as grupo_id'),
        db.raw('EXTRACT(MONTH FROM f.data_pagamento) as mes'),
        db.raw('SUM(f.valor_bruto) as total'),
      )
      .groupByRaw('COALESCE(f.fk_grupo_pag, c.fk_grupo), EXTRACT(MONTH FROM f.data_pagamento)'),

    // Total por subgrupo
    baseJoins(db('fact_ordem_pagamento as f'))
      .modify((q: any) => applyFiltrosSintetica(q, filtros))
      .whereNull('f.rateio_itens')
      .whereIn(db.raw('COALESCE(f.fk_grupo_pag, c.fk_grupo)') as any, GRUPOS_EX_ANT)
      .select(
        db.raw('COALESCE(f.fk_grupo_pag, c.fk_grupo) as grupo_id'),
        db.raw('COALESCE(f.fk_subgrupo_pag, c.fk_subgrupo) as subgrupo_id'),
        db.raw('SUM(f.valor_bruto) as total'),
      )
      .groupByRaw('COALESCE(f.fk_grupo_pag, c.fk_grupo), COALESCE(f.fk_subgrupo_pag, c.fk_subgrupo)')
      .orderBy('total', 'desc'),

    // Top credores por valor total
    baseJoins(db('fact_ordem_pagamento as f'))
      .modify((q: any) => applyFiltrosSintetica(q, filtros))
      .whereNull('f.rateio_itens')
      .whereIn(db.raw('COALESCE(f.fk_grupo_pag, c.fk_grupo)') as any, GRUPOS_EX_ANT)
      .select(
        db.raw("COALESCE(c.nome, 'Sem credor') as credor"),
        db.raw('COALESCE(f.fk_grupo_pag, c.fk_grupo) as grupo_id'),
        db.raw('SUM(f.valor_bruto) as total'),
        db.raw('COUNT(*) as qtd'),
      )
      .groupByRaw("COALESCE(c.nome, 'Sem credor'), COALESCE(f.fk_grupo_pag, c.fk_grupo)")
      .orderBy('total', 'desc'),

    // Top setores
    baseJoins(db('fact_ordem_pagamento as f'))
      .modify((q: any) => applyFiltrosSintetica(q, filtros))
      .whereNull('f.rateio_itens')
      .whereIn(db.raw('COALESCE(f.fk_grupo_pag, c.fk_grupo)') as any, GRUPOS_EX_ANT)
      .select(
        db.raw("COALESCE(st.descricao, 'Sem setor') as setor"),
        db.raw('COALESCE(f.fk_grupo_pag, c.fk_grupo) as grupo_id'),
        db.raw('SUM(f.valor_bruto) as total'),
      )
      .groupByRaw("COALESCE(st.descricao, 'Sem setor'), COALESCE(f.fk_grupo_pag, c.fk_grupo)")
      .orderBy('total', 'desc'),
  ]);

  // matrix por grupo: { [grupo_id]: { [mes]: total } }
  const matrixMes: Record<number, Record<number, number>> = {};
  for (const row of porMes) {
    const gId = Number(row.grupo_id);
    const mes = Number(row.mes);
    if (!matrixMes[gId]) matrixMes[gId] = {};
    matrixMes[gId][mes] = (matrixMes[gId][mes] || 0) + Number(row.total);
  }

  // totais globais por mês
  const totaisMes: Record<number, number> = {};
  for (const meses of Object.values(matrixMes)) {
    for (const [mesStr, v] of Object.entries(meses)) {
      const m = Number(mesStr);
      totaisMes[m] = (totaisMes[m] || 0) + v;
    }
  }

  const totalGeral = Object.values(totaisMes).reduce((a, b) => a + b, 0);
  const totalRP = Object.values(matrixMes[22] ?? {}).reduce((a, b) => a + b, 0);
  const totalDEA = Object.values(matrixMes[23] ?? {}).reduce((a, b) => a + b, 0);

  res.json({
    grupos: grupos.map((g: any) => ({ ...g })),
    subgrupos: subgrupos.map((s: any) => ({ ...s })),
    matrixMes,
    totaisMes,
    totalGeral,
    totalRP,
    totalDEA,
    porSubgrupo: porSubgrupo.map((r: any) => ({
      grupo_id: Number(r.grupo_id),
      subgrupo_id: r.subgrupo_id ? Number(r.subgrupo_id) : null,
      total: Number(r.total),
    })),
    porCredor: porCredor.map((r: any) => ({
      credor: r.credor,
      grupo_id: Number(r.grupo_id),
      total: Number(r.total),
      qtd: Number(r.qtd),
    })),
    porSetor: porSetor.map((r: any) => ({
      setor: r.setor,
      grupo_id: Number(r.grupo_id),
      total: Number(r.total),
    })),
    ano: anoFiltro,
  });
}

export async function getOutrosExerciciosProcessos(req: Request, res: Response): Promise<void> {
  const { ano, entidadeId, secretariaId, setorId, blocoId, fonteRecurso, page = '1', limit = '50' } = req.query as Record<string, string>;
  const anoFiltro = ano || new Date().getFullYear().toString();
  const filtros = { anoFiltro, entidadeId, secretariaId, setorId, blocoId, fonteRecurso };

  const pg = Math.max(1, parseInt(page));
  const lim = Math.min(200, parseInt(limit));
  const offset = (pg - 1) * lim;

  const baseQ = () =>
    db('fact_ordem_pagamento as f')
      .leftJoin('dim_credor as c', 'f.fk_credor', 'c.id')
      .leftJoin('dim_setor as st', 'f.fk_setor_pag', 'st.id')
      .join('dim_fonte_recurso as fr', 'f.fk_fonte_recurso', 'fr.id')
      .join('dim_elemento_despesa as el', 'f.fk_elemento_despesa', 'el.id')
      .leftJoin('dim_grupo_despesa as gp', db.raw('COALESCE(f.fk_grupo_pag, c.fk_grupo)') as any, 'gp.id')
      .leftJoin('dim_subgrupo_despesa as sp', db.raw('COALESCE(f.fk_subgrupo_pag, c.fk_subgrupo)') as any, 'sp.id')
      .join('dim_entidade as e', 'f.fk_entidade', 'e.id')
      .modify((q: any) => applyFiltrosSintetica(q, filtros))
      .whereNull('f.rateio_itens')
      .whereIn(db.raw('COALESCE(f.fk_grupo_pag, c.fk_grupo)') as any, GRUPOS_EX_ANT);

  const [rows, [{ total }]] = await Promise.all([
    baseQ()
      .select(
        'f.id',
        'f.data_pagamento',
        'f.num_empenho',
        'f.historico',
        db.raw('COALESCE(c.nome, f.credor_nome) as credor_nome'),
        db.raw('COALESCE(c.cnpj_cpf, f.credor_cnpj_cpf) as credor_doc'),
        'el.codigo as elemento_despesa',
        'gp.nome as grupo_nome',
        'sp.nome as subgrupo_nome',
        'st.descricao as setor_nome',
        'e.nome as entidade_nome',
        'fr.codigo as fonte_recurso',
        'f.valor_bruto',
        'f.valor_retido',
        'f.valor_liquido',
      )
      .orderBy('f.data_pagamento', 'desc')
      .limit(lim)
      .offset(offset),
    baseQ().count('f.id as total'),
  ]);

  res.json({ rows, total: Number(total), page: pg, limit: lim });
}

/** Retorna os valores disponíveis para cada filtro da sintetica (apenas registros existentes) */

export async function getDiarias(req: Request, res: Response): Promise<void> {
  const { ano, entidadeId, secretariaId, setorId, blocoId, fonteRecurso } = req.query as Record<string, string>;
  const anoFiltro = ano || new Date().getFullYear().toString();
  const filtros = { anoFiltro, entidadeId, secretariaId, setorId, blocoId, fonteRecurso };

  const baseJoins = (q: any) => q
    .leftJoin('dim_credor as c', 'f.fk_credor', 'c.id')
    .leftJoin('dim_setor as st', 'f.fk_setor_pag', 'st.id')
    .join('dim_fonte_recurso as fr', 'f.fk_fonte_recurso', 'fr.id');

  const [subgrupos, linhas, porSetor, porCredor] = await Promise.all([
    db('dim_subgrupo_despesa').where({ fk_grupo: GRUPO_DIARIAS_ID }).select('id', 'nome').orderBy('nome'),

    baseJoins(db('fact_ordem_pagamento as f'))
      .modify((q: any) => applyFiltrosSintetica(q, filtros))
      .whereNull('f.rateio_itens')
      .where(db.raw('COALESCE(f.fk_grupo_pag, c.fk_grupo)') as any, GRUPO_DIARIAS_ID)
      .select(
        db.raw('COALESCE(f.fk_subgrupo_pag, c.fk_subgrupo) as subgrupo_id'),
        db.raw('EXTRACT(MONTH FROM f.data_pagamento) as mes'),
        db.raw('SUM(f.valor_bruto) as total'),
      )
      .groupByRaw('COALESCE(f.fk_subgrupo_pag, c.fk_subgrupo), EXTRACT(MONTH FROM f.data_pagamento)'),

    baseJoins(db('fact_ordem_pagamento as f'))
      .leftJoin('dim_entidade as e', 'f.fk_entidade', 'e.id')
      .modify((q: any) => applyFiltrosSintetica(q, filtros))
      .whereNull('f.rateio_itens')
      .where(db.raw('COALESCE(f.fk_grupo_pag, c.fk_grupo)') as any, GRUPO_DIARIAS_ID)
      .select(
        db.raw("COALESCE(st.descricao, 'Sem setor') as setor"),
        db.raw('SUM(f.valor_bruto) as total'),
      )
      .groupByRaw("COALESCE(st.descricao, 'Sem setor')")
      .orderBy('total', 'desc')
      .limit(15),

    baseJoins(db('fact_ordem_pagamento as f'))
      .modify((q: any) => applyFiltrosSintetica(q, filtros))
      .whereNull('f.rateio_itens')
      .where(db.raw('COALESCE(f.fk_grupo_pag, c.fk_grupo)') as any, GRUPO_DIARIAS_ID)
      .select(
        db.raw("COALESCE(c.nome, 'Sem credor') as credor"),
        db.raw('EXTRACT(MONTH FROM f.data_pagamento) as mes'),
        db.raw('SUM(f.valor_bruto) as total'),
      )
      .groupByRaw("COALESCE(c.nome, 'Sem credor'), EXTRACT(MONTH FROM f.data_pagamento)")
      .orderBy('credor'),
  ]);

  // matrix[subgrupo_id | 0][mes] = total
  const matrix: Record<number, Record<number, number>> = {};
  for (const row of linhas) {
    const sId = Number(row.subgrupo_id) || 0;
    const mes = Number(row.mes);
    if (!matrix[sId]) matrix[sId] = {};
    matrix[sId][mes] = (matrix[sId][mes] || 0) + Number(row.total);
  }

  // totais por mês
  const totaisMes: Record<number, number> = {};
  for (const meses of Object.values(matrix)) {
    for (const [mesStr, valor] of Object.entries(meses)) {
      const mes = Number(mesStr);
      totaisMes[mes] = (totaisMes[mes] || 0) + valor;
    }
  }

  // matrix por credor: { [credor]: { [mes]: total } }
  const matrixCredor: Record<string, Record<number, number>> = {};
  for (const row of porCredor) {
    const nome = row.credor as string;
    const mes = Number(row.mes);
    if (!matrixCredor[nome]) matrixCredor[nome] = {};
    matrixCredor[nome][mes] = (matrixCredor[nome][mes] || 0) + Number(row.total);
  }
  // ordena por total decrescente
  const credores = Object.entries(matrixCredor)
    .map(([nome, meses]) => ({
      nome,
      meses,
      total: Object.values(meses).reduce((a, b) => a + b, 0),
    }))
    .sort((a, b) => b.total - a.total);

  res.json({ subgrupos, matrix, totaisMes, porSetor: porSetor.map((r: any) => ({ setor: r.setor, total: Number(r.total) })), credores, ano: anoFiltro });
}

export async function getSinteticaFiltros(req: Request, res: Response): Promise<void> {
  const { ano } = req.query as Record<string, string>;
  const anoFiltro = ano || new Date().getFullYear().toString();

  const base = () =>
    db('fact_ordem_pagamento as f')
      .leftJoin('dim_setor as st', 'f.fk_setor_pag', 'st.id')
      .join('dim_fonte_recurso as fr', 'f.fk_fonte_recurso', 'fr.id')
      .whereRaw('EXTRACT(YEAR FROM f.data_pagamento) = ?', [anoFiltro]);

  const [entidades, secretarias, setores, blocos, fontes, grupos, subgrupos] = await Promise.all([
    base()
      .join('dim_entidade as e', 'f.fk_entidade', 'e.id')
      .distinct('e.id', 'e.nome')
      .orderBy('e.nome')
      .select('e.id', 'e.nome'),

    base()
      .join('dim_secretaria as sec', 'st.fk_secretaria', 'sec.id')
      .whereNotNull('st.fk_secretaria')
      .distinct('sec.id', 'sec.nome', 'sec.sigla')
      .orderBy('sec.nome')
      .select('sec.id', 'sec.nome', 'sec.sigla'),

    base()
      .whereNotNull('f.fk_setor_pag')
      .distinct('st.id', 'st.descricao')
      .orderBy('st.descricao')
      .select('st.id', 'st.descricao'),

    base()
      .join('dim_bloco as bl', 'st.fk_bloco', 'bl.id')
      .whereNotNull('st.fk_bloco')
      .distinct('bl.id', 'bl.descricao')
      .orderBy('bl.descricao')
      .select('bl.id', 'bl.descricao'),

    base()
      .distinct('fr.codigo')
      .orderBy('fr.codigo')
      .select('fr.codigo'),

    db('dim_grupo_despesa').select('id', 'nome').orderBy('nome'),
    db('dim_subgrupo_despesa').select('id', 'nome', 'fk_grupo').orderBy('nome'),
  ]);

  res.json({
    entidades,
    secretarias,
    setores,
    blocos,
    fontes: fontes.map((f: any) => f.codigo),
    grupos,
    subgrupos,
  });
}

export async function getCardStats(req: Request, res: Response): Promise<void> {
  const { dataInicio, dataFim, entidadeId, credorSearch, tipoRelatorio, grupoId, subgrupoId } = req.query as Record<string, string>;

  const [row] = await db('fact_ordem_pagamento as f')
    .leftJoin('dim_credor as c', 'f.fk_credor', 'c.id')
    .modify((q: any) => {
      if (dataInicio) q.where('f.data_pagamento', '>=', dataInicio);
      if (dataFim)    q.where('f.data_pagamento', '<=', dataFim);
      if (entidadeId) q.where('f.fk_entidade', entidadeId);
      if (tipoRelatorio) q.where('f.tipo_relatorio', tipoRelatorio);
      if (grupoId)    q.where(db.raw('COALESCE(f.fk_grupo_pag, c.fk_grupo)') as any, grupoId);
      if (subgrupoId) q.where(db.raw('COALESCE(f.fk_subgrupo_pag, c.fk_subgrupo)') as any, subgrupoId);
      if (credorSearch) q.where((w: any) => w
        .where('c.nome', 'ilike', `%${credorSearch}%`)
        .orWhere('f.credor_nome', 'ilike', `%${credorSearch}%`));
    })
    .select(
      db.raw('COUNT(*) as total_processos'),
      db.raw('SUM(f.valor_bruto) as valor_total'),
      db.raw('SUM(CASE WHEN f.fk_setor_pag IS NULL THEN 1 ELSE 0 END) as sem_setor'),
      db.raw('SUM(CASE WHEN COALESCE(f.fk_grupo_pag, c.fk_grupo) IS NULL THEN 1 ELSE 0 END) as sem_grupo'),
      db.raw('SUM(CASE WHEN COALESCE(f.fk_subgrupo_pag, c.fk_subgrupo) IS NULL THEN 1 ELSE 0 END) as sem_subgrupo'),
    );
  res.json({
    totalProcessos: Number(row.total_processos || 0),
    valorTotal: Number(row.valor_total || 0),
    semSetor: Number(row.sem_setor || 0),
    semGrupo: Number(row.sem_grupo || 0),
    semSubgrupo: Number(row.sem_subgrupo || 0),
  });
}

export async function exportPagamentos(req: Request, res: Response): Promise<void> {
  const { dataInicio, dataFim, credorId, entidadeId, elementoDespesa, fonteRecurso } =
    req.query as Record<string, string>;

  const rows = await db('fact_ordem_pagamento as f')
    .join('dim_entidade as e', 'f.fk_entidade', 'e.id')
    .join('dim_credor as c', 'f.fk_credor', 'c.id')
    .join('dim_tipo_empenho as te', 'f.fk_tipo_empenho', 'te.id')
    .join('dim_elemento_despesa as el', 'f.fk_elemento_despesa', 'el.id')
    .join('dim_fonte_recurso as fr', 'f.fk_fonte_recurso', 'fr.id')
    .select(
      'f.data_pagamento', 'f.num_empenho', 'f.reduzido', 'f.num_processo',
      'e.nome as entidade', 'e.cnpj as entidade_cnpj',
      'c.nome as credor', 'c.cnpj_cpf as credor_cnpj',
      'te.descricao as tipo_empenho',
      'el.codigo as elemento_despesa', 'fr.codigo as fonte_recurso',
      'f.valor_bruto', 'f.valor_retido', 'f.valor_liquido',
      'f.data_empenho', 'f.data_liquidacao', 'f.historico',
    )
    .modify((q) => {
      if (dataInicio) q.where('f.data_pagamento', '>=', dataInicio);
      if (dataFim) q.where('f.data_pagamento', '<=', dataFim);
      if (credorId) q.where('f.fk_credor', credorId);
      if (entidadeId) q.where('f.fk_entidade', entidadeId);
      if (elementoDespesa) q.where('el.codigo', 'like', `%${elementoDespesa}%`);
      if (fonteRecurso) q.where('fr.codigo', fonteRecurso);
    })
    .orderBy('f.data_pagamento', 'desc')
    .limit(50000);

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Pagamentos');

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader('Content-Disposition', 'attachment; filename="pagamentos.xlsx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
}
