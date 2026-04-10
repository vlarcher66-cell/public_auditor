import { Request, Response } from 'express';
import { db } from '../config/database';
import { getTenantFilter, applyTenantFilter } from '../middleware/auth.middleware';

// ── Listagem paginada de credores a pagar ──────────────────────────────────────
export async function listCredoresAPagar(req: Request, res: Response): Promise<void> {
  const user = req.user!;
  const tf = getTenantFilter(user);

  const page     = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit    = Math.min(100, parseInt(req.query.limit as string) || 50);
  const offset   = (page - 1) * limit;
  const semGrupo = req.query.semGrupo === '1';
  const search   = req.query.search as string | undefined;

  function buildBase() {
    const q = db('dim_credor_a_pagar as c')
      .leftJoin('dim_grupo_despesa as g', 'c.fk_grupo', 'g.id')
      .leftJoin('dim_subgrupo_despesa as s', 'c.fk_subgrupo', 's.id');

    // Multi-tenant: filtra por municipio
    if (tf.type === 'entidade') {
      // Resolve municipio da entidade
      q.whereIn('c.fk_municipio',
        db('dim_entidade').select('fk_municipio').whereIn('id', tf.ids)
      );
    } else if (tf.type === 'municipio') {
      q.where('c.fk_municipio', tf.id);
    }

    if (semGrupo) q.whereNull('c.fk_grupo');
    if (search)   q.whereRaw('UPPER(c.nome) LIKE ?', [`%${search.toUpperCase()}%`]);

    return q;
  }

  const [rows, countRow] = await Promise.all([
    buildBase()
      .select(
        'c.id', 'c.nome', 'c.historico', 'c.fk_grupo', 'c.fk_subgrupo', 'c.criado_em',
        'g.nome as grupo_nome',
        's.nome as subgrupo_nome',
      )
      .orderBy('c.nome', 'asc')
      .limit(limit)
      .offset(offset),
    buildBase().count('c.id as total').first(),
  ]);

  const semGrupoCount = await buildBase().whereNull('c.fk_grupo').count('c.id as total').first();

  res.json({
    rows,
    total: Number((countRow as any)?.total ?? 0),
    sem_grupo: Number((semGrupoCount as any)?.total ?? 0),
    page,
    limit,
  });
}

// ── Classificar (atribuir grupo/subgrupo) ─────────────────────────────────────
export async function classificarCredorAPagar(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { fk_grupo, fk_subgrupo } = req.body;

  const credor = await db('dim_credor_a_pagar').where('id', id).first();
  if (!credor) {
    res.status(404).json({ error: 'Credor não encontrado' });
    return;
  }

  await db('dim_credor_a_pagar').where('id', id).update({
    fk_grupo:    fk_grupo    ?? null,
    fk_subgrupo: fk_subgrupo ?? null,
  });

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

// ── Grupos e subgrupos disponíveis (para os dropdowns) ────────────────────────
export async function getGruposSubgrupos(_req: Request, res: Response): Promise<void> {
  const [grupos, subgrupos] = await Promise.all([
    db('dim_grupo_despesa').select('id', 'nome').orderBy('nome'),
    db('dim_subgrupo_despesa').select('id', 'nome', 'fk_grupo').orderBy('nome'),
  ]);
  res.json({ grupos, subgrupos });
}
