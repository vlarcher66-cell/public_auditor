import { Request, Response } from 'express';
import { db } from '../config/database';
import { getTenantFilter, applyTenantFilter } from '../middleware/auth.middleware';
import { isSuperAdmin } from '../config/roles';

// ── Listagem paginada de credores a pagar ──────────────────────────────────────
// aba: 'classificados' | 'sem_classificacao' | 'revisao'
export async function listCredoresAPagar(req: Request, res: Response): Promise<void> {
  const user = req.user!;
  const tf = getTenantFilter(user);

  const page   = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit  = Math.min(100, parseInt(req.query.limit as string) || 50);
  const offset = (page - 1) * limit;
  const search = req.query.search as string | undefined;
  const aba    = (req.query.aba as string) || 'classificados';

  // Aba revisão só permitida para SUPER_ADMIN
  if (aba === 'revisao' && !isSuperAdmin(user.role)) {
    res.status(403).json({ error: 'Acesso negado' });
    return;
  }

  function buildBase() {
    const q = db('dim_credor_a_pagar as c')
      .leftJoin('dim_grupo_despesa as g', 'c.fk_grupo', 'g.id')
      .leftJoin('dim_subgrupo_despesa as s', 'c.fk_subgrupo', 's.id')
      .leftJoin('usuarios as u', 'c.classificado_por', 'u.id');

    if (tf.entidades_ids && tf.entidades_ids.length > 0) {
      q.whereIn('c.fk_municipio',
        db('dim_entidade').select('fk_municipio').whereIn('id', tf.entidades_ids)
      );
    } else if (tf.fk_entidade) {
      q.whereIn('c.fk_municipio',
        db('dim_entidade').select('fk_municipio').where('id', tf.fk_entidade)
      );
    } else if (tf.fk_municipio) {
      q.where('c.fk_municipio', tf.fk_municipio);
    }

    if (aba === 'classificados')      q.whereNotNull('c.fk_grupo');
    if (aba === 'sem_classificacao')  q.whereNull('c.fk_grupo');
    if (aba === 'revisao') {
      // classificados por alguém diferente do usuário atual (não pelo próprio SUPER_ADMIN)
      q.whereNotNull('c.classificado_por').whereNot('c.classificado_por', user.sub);
    }

    if (search) q.whereRaw('UPPER(c.nome) LIKE ?', [`%${search.toUpperCase()}%`]);

    return q;
  }

  const [rows, countRow, semGrupoRow, comGrupoRow] = await Promise.all([
    buildBase()
      .select(
        'c.id', 'c.nome', 'c.historico', 'c.fk_grupo', 'c.fk_subgrupo', 'c.criado_em',
        'c.detalhar_no_pagamento', 'c.classificado_por',
        'g.nome as grupo_nome',
        's.nome as subgrupo_nome',
        'u.nome as classificado_por_nome',
      )
      .orderBy('c.nome', 'asc')
      .limit(limit)
      .offset(offset),
    buildBase().count('c.id as total').first(),
    // contagens globais (sem filtro de aba) para os badges
    db('dim_credor_a_pagar as c').modify((q: any) => {
      if (tf.fk_municipio) q.where('c.fk_municipio', tf.fk_municipio);
    }).whereNull('c.fk_grupo').count('c.id as total').first(),
    db('dim_credor_a_pagar as c').modify((q: any) => {
      if (tf.fk_municipio) q.where('c.fk_municipio', tf.fk_municipio);
    }).whereNotNull('c.fk_grupo').count('c.id as total').first(),
  ]);

  res.json({
    rows,
    total:         Number((countRow as any)?.total ?? 0),
    sem_grupo:     Number((semGrupoRow as any)?.total ?? 0),
    com_grupo:     Number((comGrupoRow as any)?.total ?? 0),
    page,
    limit,
  });
}

// ── Classificar (atribuir grupo/subgrupo) ─────────────────────────────────────
export async function classificarCredorAPagar(req: Request, res: Response): Promise<void> {
  const user = req.user!;
  const { id } = req.params;
  const { fk_grupo, fk_subgrupo, historico, detalhar_no_pagamento } = req.body;

  const credor = await db('dim_credor_a_pagar').where('id', id).first();
  if (!credor) {
    res.status(404).json({ error: 'Credor não encontrado' });
    return;
  }

  const update: Record<string, any> = {
    fk_grupo:    fk_grupo    ?? null,
    fk_subgrupo: fk_subgrupo ?? null,
  };
  if (historico !== undefined)             update.historico = historico ?? null;
  if (detalhar_no_pagamento !== undefined) update.detalhar_no_pagamento = !!detalhar_no_pagamento;

  // Grava quem classificou (só quando está atribuindo um grupo)
  if (fk_grupo) update.classificado_por = user.sub;

  await db('dim_credor_a_pagar').where('id', id).update(update);

  res.json({ ok: true });
}

// ── Excluir credor individualmente (SUPER_ADMIN) ──────────────────────────────
export async function deleteCredorAPagar(req: Request, res: Response): Promise<void> {
  const user = req.user!;
  if (!isSuperAdmin(user.role)) {
    res.status(403).json({ error: 'Acesso negado' });
    return;
  }

  const { id } = req.params;
  await db('dim_credor_a_pagar').where('id', id).delete();
  res.json({ ok: true });
}

// ── Classificação em lote ─────────────────────────────────────────────────────
export async function classificarLoteCredoresAPagar(req: Request, res: Response): Promise<void> {
  const { ids, fk_grupo, fk_subgrupo } = req.body as {
    ids: number[];
    fk_grupo: number | null;
    fk_subgrupo: number | null;
  };

  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ error: 'ids é obrigatório' });
    return;
  }

  const updated = await db('dim_credor_a_pagar')
    .whereIn('id', ids)
    .update({ fk_grupo: fk_grupo ?? null, fk_subgrupo: fk_subgrupo ?? null });

  res.json({ ok: true, updated });
}

// ── Limpar todos os credores a pagar ─────────────────────────────────────────
export async function deleteAllCredoresAPagar(_req: Request, res: Response): Promise<void> {
  try {
    await db.raw('DELETE FROM dim_credor_a_pagar');
    res.json({ message: 'Todos os credores a pagar foram excluídos' });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? 'Erro ao excluir' });
  }
}

// ── Grupos e subgrupos disponíveis (para os dropdowns) ────────────────────────
export async function getGruposSubgrupos(_req: Request, res: Response): Promise<void> {
  const [grupos, subgrupos] = await Promise.all([
    db('dim_grupo_despesa').select('id', 'nome').orderBy('nome'),
    db('dim_subgrupo_despesa').select('id', 'nome', 'fk_grupo').orderBy('nome'),
  ]);
  res.json({ grupos, subgrupos });
}
