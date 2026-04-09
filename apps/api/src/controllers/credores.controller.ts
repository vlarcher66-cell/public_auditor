import { Request, Response } from 'express';
import { db } from '../config/database';
import { logger } from '../config/logger';
import { getTenantFilter } from '../middleware/auth.middleware';
import { classificarTodosCredoresDiarias, classificarCredorDiarias } from '../services/diariasClassificacao.service';
import { classificarPorHistorico, listarCredoresParaConfirmar } from '../services/classificacaoHistorico.service';

// ── Grupos ────────────────────────────────────────────────────────────────────

export async function listGrupos(req: Request, res: Response): Promise<void> {
  const tf = getTenantFilter(req.user!);
  const q = db('dim_grupo_despesa').orderBy('nome');
  if (tf.fk_municipio) q.where('fk_municipio', tf.fk_municipio);
  res.json(await q);
}

export async function createGrupo(req: Request, res: Response): Promise<void> {
  const { nome, descricao } = req.body;
  if (!nome?.trim()) { res.status(400).json({ error: 'Nome obrigatório' }); return; }

  const exists = await db('dim_grupo_despesa').where('nome', nome.trim()).first();
  if (exists) { res.status(409).json({ error: 'Grupo já existe', id: exists.id }); return; }

  const [{ id }] = await db('dim_grupo_despesa').insert({ nome: nome.trim(), descricao: descricao?.trim() || null }).returning('id');
  res.status(201).json({ id, nome: nome.trim(), descricao: descricao?.trim() || null });
}

export async function updateGrupo(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { nome, descricao } = req.body;
  if (!nome?.trim()) { res.status(400).json({ error: 'Nome obrigatório' }); return; }

  await db('dim_grupo_despesa').where({ id }).update({ nome: nome.trim(), descricao: descricao?.trim() || null });
  res.json({ message: 'Grupo atualizado' });
}

const GRUPOS_PROTEGIDOS = ['RESTOS A PAGAR', 'DESPESAS DO EXERCÍCIO ANTERIOR', 'DESPESAS DO EXERCICIO ANTERIOR'];

export async function deleteGrupo(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const grupo = await db('dim_grupo_despesa').where({ id }).first();
  if (grupo && GRUPOS_PROTEGIDOS.some((p: string) => grupo.nome.toUpperCase().includes(p))) {
    res.status(403).json({ error: `O grupo "${grupo.nome}" é protegido pelo sistema e não pode ser excluído.` });
    return;
  }
  const credores = await db('dim_credor').where('fk_grupo', id).count('id as n').first();
  if (Number((credores as any)?.n) > 0) {
    res.status(409).json({ error: 'Grupo possui credores vinculados. Desvincule-os antes de excluir.' });
    return;
  }
  await db('dim_grupo_despesa').where({ id }).delete();
  res.json({ message: 'Grupo excluído' });
}

// ── Subgrupos ─────────────────────────────────────────────────────────────────

export async function listSubgrupos(req: Request, res: Response): Promise<void> {
  const tf = getTenantFilter(req.user!);
  let q = db('dim_subgrupo_despesa as s')
    .join('dim_grupo_despesa as g', 's.fk_grupo', 'g.id')
    .select('s.*', 'g.nome as grupo_nome')
    .orderBy('g.nome').orderBy('s.nome');
  if (tf.fk_municipio) q = q.where('g.fk_municipio', tf.fk_municipio);
  if (req.query.grupoId) q = q.where('s.fk_grupo', req.query.grupoId);
  res.json(await q);
}

export async function createSubgrupo(req: Request, res: Response): Promise<void> {
  const { nome, fk_grupo } = req.body;
  if (!nome?.trim() || !fk_grupo) { res.status(400).json({ error: 'Nome e grupo obrigatórios' }); return; }

  const exists = await db('dim_subgrupo_despesa').where({ nome: nome.trim(), fk_grupo }).first();
  if (exists) { res.status(409).json({ error: 'Subgrupo já existe neste grupo', id: exists.id }); return; }

  const [{ id }] = await db('dim_subgrupo_despesa').insert({ nome: nome.trim(), fk_grupo }).returning('id');
  res.status(201).json({ id, nome: nome.trim(), fk_grupo });
}

export async function updateSubgrupo(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { nome, fk_grupo } = req.body;
  if (!nome?.trim()) { res.status(400).json({ error: 'Nome obrigatório' }); return; }
  await db('dim_subgrupo_despesa').where({ id }).update({ nome: nome.trim(), fk_grupo: fk_grupo || undefined });
  res.json({ message: 'Subgrupo atualizado' });
}

export async function deleteSubgrupo(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  await db('dim_subgrupo_despesa').where({ id }).delete();
  res.json({ message: 'Subgrupo excluído' });
}

// ── Credores ──────────────────────────────────────────────────────────────────

export async function listCredores(req: Request, res: Response): Promise<void> {
  const { search, grupoId, semGrupo, semSubgrupo, origem, page = '1', limit = '50' } = req.query as Record<string, string>;
  const pg = Math.max(1, parseInt(page));
  const lim = Math.min(200, parseInt(limit));
  const offset = (pg - 1) * lim;

  const tf = getTenantFilter(req.user!);
  const base = () =>
    db('dim_credor as c')
      .leftJoin('dim_grupo_despesa as g', 'c.fk_grupo', 'g.id')
      .leftJoin('dim_subgrupo_despesa as s', 'c.fk_subgrupo', 's.id')
      .modify((q) => {
        if (tf.fk_municipio) q.where('c.fk_municipio', tf.fk_municipio);
        if (search) q.where((w) => w.where('c.nome', 'ilike', `%${search}%`).orWhere('c.cnpj_cpf', 'ilike', `%${search}%`));
        if (grupoId) q.where('c.fk_grupo', grupoId);
        if (semGrupo === '1') q.whereNull('c.fk_grupo');
        if (semSubgrupo === '1') q.whereNotNull('c.fk_grupo').whereNull('c.fk_subgrupo');
        if (origem === 'PAGO')     q.where('c.origem', 'PAGO');
        if (origem === 'A_PAGAR')  q.where('c.origem', 'A_PAGAR');
        if (origem === 'SEM')      q.whereNull('c.origem');
      });

  const [rows, [{ total }]] = await Promise.all([
    base()
      .select(
        'c.id', 'c.nome', 'c.cnpj_cpf', 'c.cnpj_cpf_norm', 'c.tipo_doc',
        'c.fk_grupo', 'g.nome as grupo_nome',
        'c.fk_subgrupo', 's.nome as subgrupo_nome',
        'c.historico', 'c.precisa_reclassificacao', 'c.detalhar_no_pagamento', 'c.origem',
      )
      .orderBy('c.nome')
      .limit(lim).offset(offset),
    base().count('c.id as total'),
  ]);

  res.json({ rows, total: Number(total), page: pg, limit: lim });
}

export async function autoClassificarCredoresDiarias(_req: Request, res: Response): Promise<void> {
  // Credores sem grupo que:
  // (a) têm pelo menos um pagamento com elemento 3.3.90.14, OU
  // (b) têm histórico de pagamento que menciona diária
  const credores = await db('dim_credor as c')
    .whereNull('c.fk_grupo')
    .where((w) => {
      w.whereExists(
        db('fact_ordem_pagamento as f')
          .join('dim_elemento_despesa as el', 'f.fk_elemento_despesa', 'el.id')
          .where('f.fk_credor', db.raw('c.id'))
          .where('el.codigo', 'like', '3.3.90.14%')
          .select(db.raw('1'))
      )
      .orWhere('c.historico', 'like', '%DIÁRI%')
      .orWhere('c.historico', 'like', '%DIARIA%');
    })
    .select('c.id');

  if (credores.length === 0) {
    res.json({ updated: 0 });
    return;
  }

  const ids = credores.map((c: any) => c.id);
  await db('dim_credor').whereIn('id', ids).update({ fk_grupo: 8, precisa_reclassificacao: false });

  res.json({ updated: ids.length });
}

// Grupos especiais que geram subgrupo prefixado automaticamente
const GRUPOS_COM_PREFIXO: Record<number, string> = {
  23: 'DEA',
  22: 'RP',
};

export async function updateCredor(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { fk_grupo, fk_subgrupo, historico, detalhar_no_pagamento } = req.body;

  const update: Record<string, any> = {
    fk_grupo: fk_grupo || null,
    fk_subgrupo: fk_subgrupo || null,
  };
  if (historico !== undefined) update.historico = historico || null;
  if (detalhar_no_pagamento !== undefined) update.detalhar_no_pagamento = detalhar_no_pagamento;
  if (fk_grupo) update.precisa_reclassificacao = false;

  await db('dim_credor').where({ id }).update(update);

  // Se o credor recebeu um novo subgrupo, atualiza os pagamentos DEA/RP
  // desse credor que já foram classificados nesses grupos especiais
  if (fk_subgrupo) {
    const subgrupo = await db('dim_subgrupo_despesa').where({ id: fk_subgrupo }).first();
    if (subgrupo) {
      for (const [grupoId, prefixo] of Object.entries(GRUPOS_COM_PREFIXO)) {
        const nomeComPrefixo = `${prefixo} - ${subgrupo.nome}`;

        // Find-or-create subgrupo prefixado dentro do grupo DEA/RP
        let subgrupoPrefixado = await db('dim_subgrupo_despesa')
          .where({ nome: nomeComPrefixo, fk_grupo: grupoId })
          .first();

        if (!subgrupoPrefixado) {
          const [{ id: novoId }] = await db('dim_subgrupo_despesa').insert({
            nome: nomeComPrefixo,
            fk_grupo: grupoId,
          }).returning('id');
          subgrupoPrefixado = { id: novoId };
        }

        // Atualiza todos os pagamentos desse credor classificados nesse grupo especial
        await db('fact_ordem_pagamento')
          .where({ fk_credor: id, fk_grupo_pag: grupoId })
          .update({ fk_subgrupo_pag: subgrupoPrefixado.id });
      }
    }
  }

  res.json({ message: 'Credor atualizado' });
}

export async function deleteAllCredores(_req: Request, res: Response): Promise<void> {
  try {
    await db.raw('SET session_replication_role = replica');
    await db.raw('DELETE FROM dim_credor');
    await db.raw('SET session_replication_role = DEFAULT');
    res.json({ message: 'Todos os credores foram excluídos' });
  } catch (err: any) {
    logger.error({ err: err?.message, stack: err?.stack }, 'deleteAllCredores failed');
    await db.raw('SET session_replication_role = DEFAULT').catch(() => {});
    res.status(500).json({ error: err?.message ?? 'Erro desconhecido ao excluir credores' });
  }
}

export async function getCredorClassificacao(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  const rows = await db('fact_ordem_pagamento as f')
    .where('f.fk_credor', id)
    .join('dim_elemento_despesa as el', 'f.fk_elemento_despesa', 'el.id')
    .join('dim_fonte_recurso as fr', 'f.fk_fonte_recurso', 'fr.id')
    .join('dim_tipo_empenho as te', 'f.fk_tipo_empenho', 'te.id')
    .join('dim_entidade as e', 'f.fk_entidade', 'e.id')
    .leftJoin('dim_setor as st', 'f.fk_setor_pag', 'st.id')
    .select(
      'el.codigo as elemento',
      'fr.codigo as fonte',
      'te.descricao as tipo_empenho',
      'e.nome as entidade',
      db.raw('EXTRACT(YEAR FROM f.data_pagamento) as ano'),
      db.raw('COUNT(*) as qtd'),
      db.raw('SUM(f.valor_bruto) as total'),
      db.raw('MAX(f.data_pagamento) as ultimo_pagamento'),
    )
    .groupByRaw('el.codigo, fr.codigo, te.descricao, e.nome, EXTRACT(YEAR FROM f.data_pagamento)')
    .orderByRaw('EXTRACT(YEAR FROM f.data_pagamento) DESC, SUM(f.valor_bruto) DESC')
    .limit(30);

  res.json(rows.map((r: any) => ({
    elemento: r.elemento,
    fonte: r.fonte,
    tipo_empenho: r.tipo_empenho,
    entidade: r.entidade,
    ano: Number(r.ano),
    qtd: Number(r.qtd),
    total: Number(r.total),
    ultimo_pagamento: r.ultimo_pagamento,
  })));
}

export async function getCredorStats(_req: Request, res: Response): Promise<void> {
  const [total, semGrupo, semSubgrupo, aPagar] = await Promise.all([
    db('dim_credor').count('id as n').first(),
    db('dim_credor').whereNull('fk_grupo').count('id as n').first(),
    db('dim_credor').whereNotNull('fk_grupo').whereNull('fk_subgrupo').count('id as n').first(),
    db('dim_credor').where('origem', 'A_PAGAR').count('id as n').first(),
  ]);
  res.json({
    total:      Number((total      as any)?.n || 0),
    semGrupo:   Number((semGrupo   as any)?.n || 0),
    semSubgrupo:Number((semSubgrupo as any)?.n || 0),
    aPagar:     Number((aPagar     as any)?.n || 0),
  });
}

export async function autoClassificarDiariasPorHistorico(_req: Request, res: Response): Promise<void> {
  try {
    const resultado = await classificarTodosCredoresDiarias();
    res.json(resultado);
  } catch (err: any) {
    logger.error({ err: err?.message }, 'Erro ao classificar diárias por histórico');
    res.status(500).json({ error: err?.message ?? 'Erro ao classificar' });
  }
}

export async function autoClassificarCredorDiariaIndividual(req: Request, res: Response): Promise<void> {
  try {
    const credorId = parseInt(req.params.id as string);

    const { atualizado, resultado } = await classificarCredorDiarias(credorId);
    res.json({ atualizado, resultado });
  } catch (err: any) {
    logger.error({ err: err?.message }, 'Erro ao classificar credor');
    res.status(500).json({ error: err?.message ?? 'Erro ao classificar' });
  }
}

// ─── Pessoal ──────────────────────────────────────────────────────────────────

export async function listarCredoresParaConfirmarPessoal(req: Request, res: Response): Promise<void> {
  try {
    const { page = '1', limit = '10' } = req.query as Record<string, string>;
    const pg = Math.max(1, parseInt(page));
    const lim = Math.min(100, parseInt(limit));

    const { rows, total } = await listarCredoresParaConfirmar('3.1.90.11%', '%PESSOAL%', undefined, pg, lim);

    const credoresComSugestao = await Promise.all(
      rows.map(async (credor: any) => {
        const sugestao = await classificarPorHistorico(credor.historico, '%PESSOAL%', 'FOPAG');
        return { ...credor, sugestao };
      })
    );

    const ordemConfianca = { alta: 0, media: 1, baixa: 2, nenhuma: 3 };
    credoresComSugestao.sort((a, b) =>
      (ordemConfianca[a.sugestao.confianca as keyof typeof ordemConfianca] ?? 3) -
      (ordemConfianca[b.sugestao.confianca as keyof typeof ordemConfianca] ?? 3)
    );

    res.json({ rows: credoresComSugestao, total, page: pg, limit: lim });
  } catch (err: any) {
    logger.error({ err: err?.message }, 'Erro ao listar credores pessoal');
    res.status(500).json({ error: err?.message ?? 'Erro ao listar' });
  }
}

export async function confirmarClassificacaoPessoalCredor(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { fk_subgrupo } = req.body;
    if (!fk_subgrupo) { res.status(400).json({ error: 'fk_subgrupo é obrigatório' }); return; }

    await db('dim_credor').where('id', id).update({ fk_subgrupo, precisa_reclassificacao: false });
    logger.info({ credorId: id, subgrupoId: fk_subgrupo }, 'Classificação de pessoal confirmada');
    res.json({ message: 'Classificação confirmada com sucesso' });
  } catch (err: any) {
    logger.error({ err: err?.message }, 'Erro ao confirmar classificação pessoal');
    res.status(500).json({ error: err?.message ?? 'Erro ao confirmar' });
  }
}

export async function testeClassificacaoDiaria(req: Request, res: Response): Promise<void> {
  try {
    const { historico } = req.body;

    if (!historico) {
      res.status(400).json({ error: 'historico é obrigatório' });
      return;
    }

    const { classificarDiariasPorHistorico } = await import('../services/diariasClassificacao.service');
    const resultado = await classificarDiariasPorHistorico(historico);

    res.json({
      historico: historico.substring(0, 150),
      resultado,
    });
  } catch (err: any) {
    logger.error({ err: err?.message }, 'Erro no teste de classificação');
    res.status(500).json({ error: err?.message ?? 'Erro ao testar' });
  }
}

export async function listarCredoresParaConfirmarDiarias(req: Request, res: Response): Promise<void> {
  try {
    const { page = '1', limit = '20' } = req.query as Record<string, string>;
    const pg = Math.max(1, parseInt(page));
    const lim = Math.min(100, parseInt(limit));
    const offset = (pg - 1) * lim;

    // Lista credores SEM SUBGRUPO que têm pagamentos com elemento 3.3.90.14 (único critério de diária)
    const base = () => db('dim_credor as c')
      .join('dim_grupo_despesa as g', 'c.fk_grupo', 'g.id')
      .whereNull('c.fk_subgrupo')
      .where(function () {
        this.where('g.nome', 'like', '%DIÁRIA%').orWhere('g.nome', 'like', '%DIARIA%');
      })
      .whereExists(
        db('fact_ordem_pagamento as f')
          .join('dim_elemento_despesa as el', 'f.fk_elemento_despesa', 'el.id')
          .where('f.fk_credor', db.raw('c.id'))
          .where('el.codigo', 'like', '3.3.90.14%')
          .select(db.raw('1'))
      );

    const [credores, [{ total }]] = await Promise.all([
      base()
        .select('c.id', 'c.nome', 'c.historico', 'c.fk_grupo', 'g.nome as grupo_nome')
        .orderBy('c.nome')
        .limit(lim)
        .offset(offset),
      base().count('c.id as total'),
    ]);

    // Para cada credor, busca a sugestão de subgrupo
    const { classificarDiariasPorHistorico } = await import('../services/diariasClassificacao.service');
    const credoresComSugestao = await Promise.all(
      credores.map(async (credor: any) => {
        const sugestao = await classificarDiariasPorHistorico(credor.historico);
        return { ...credor, sugestao };
      })
    );

    // Ordena: identificados (alta/media/baixa) primeiro, sem identificação por último
    const ordemConfianca = { alta: 0, media: 1, baixa: 2, nenhuma: 3 };
    credoresComSugestao.sort((a, b) =>
      (ordemConfianca[a.sugestao.confianca as keyof typeof ordemConfianca] ?? 3) -
      (ordemConfianca[b.sugestao.confianca as keyof typeof ordemConfianca] ?? 3)
    );

    res.json({
      rows: credoresComSugestao,
      total: Number(total),
      page: pg,
      limit: lim,
    });
  } catch (err: any) {
    logger.error({ err: err?.message }, 'Erro ao listar credores para confirmar');
    res.status(500).json({ error: err?.message ?? 'Erro ao listar' });
  }
}

export async function confirmarClassificacaoDiariaCredor(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { fk_subgrupo } = req.body;

    if (!fk_subgrupo) {
      res.status(400).json({ error: 'fk_subgrupo é obrigatório' });
      return;
    }

    // Valida se o subgrupo existe e é de diárias
    const subgrupo = await db('dim_subgrupo_despesa as s')
      .join('dim_grupo_despesa as g', 's.fk_grupo', 'g.id')
      .where('s.id', fk_subgrupo)
      .where(function () {
        this.where('g.nome', 'like', '%DIÁRIA%').orWhere('g.nome', 'like', '%DIARIA%');
      })
      .first();

    if (!subgrupo) {
      res.status(400).json({ error: 'Subgrupo inválido ou não é de diárias' });
      return;
    }

    // Atualiza o credor com o subgrupo confirmado
    await db('dim_credor').where('id', id).update({
      fk_subgrupo,
      precisa_reclassificacao: false,
    });

    logger.info({ credorId: id, subgrupoId: fk_subgrupo }, 'Classificação de diária confirmada');

    res.json({ message: 'Classificação confirmada com sucesso' });
  } catch (err: any) {
    logger.error({ err: err?.message }, 'Erro ao confirmar classificação');
    res.status(500).json({ error: err?.message ?? 'Erro ao confirmar' });
  }
}
