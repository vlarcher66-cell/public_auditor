import { Router } from 'express';
import authRoutes from './auth.routes';
import importRoutes from './import.routes';
import pagamentosRoutes from './pagamentos.routes';
import credoresRoutes from './credores.routes';
import usuariosRoutes from './usuarios.routes';
import setoresRoutes from './setores.routes';
import blocosRoutes from './blocos.routes';
import entidadesRoutes from './entidades.routes';
import secretariasRoutes from './secretarias.routes';
import regraEmpenhoRoutes from './regraEmpenho.routes';
import mmRoutes from './mm.routes';
import municipiosRoutes from './municipios.routes';
import receitasRoutes from './receitas.routes';
import transferenciasRoutes from './transferencias.routes';
import indice15Routes from './indice15.routes';
import metasRoutes from './metas.routes';
import empenhoLiquidadoRoutes from './empenhoLiquidado.routes';
import relatorioQuadrimestralRoutes from './relatorioQuadrimestral.routes';
import { db } from '../config/database';
import { authMiddleware } from '../middleware/auth.middleware';
import { backfillEmpenhoBase } from '../controllers/pagamentos.controller';
import { listCredoresAPagar, classificarCredorAPagar, classificarLoteCredoresAPagar, getGruposSubgrupos, deleteAllCredoresAPagar } from '../controllers/credorAPagar.controller';

const router = Router();

router.use('/auth', authRoutes);
router.use('/import', importRoutes);
router.use('/pagamentos', pagamentosRoutes);
router.use('/credores', credoresRoutes);
router.use('/usuarios', usuariosRoutes);
router.use('/setores', setoresRoutes);
router.use('/blocos', blocosRoutes);
router.use('/entidades', entidadesRoutes);
router.use('/secretarias', secretariasRoutes);
router.use('/regras-empenho', regraEmpenhoRoutes);
router.use('/mm', mmRoutes);
router.use('/municipios', municipiosRoutes);
router.use('/receitas', receitasRoutes);
router.use('/transferencias-bancarias', transferenciasRoutes);
router.use('/indice15', indice15Routes);
router.use('/metas', metasRoutes);
router.use('/empenhos-liquidados', empenhoLiquidadoRoutes);
router.use('/relatorio-quadrimestral', relatorioQuadrimestralRoutes);

router.post('/admin/backfill-empenho-base', backfillEmpenhoBase);
router.post('/admin/fix-regra-credor', async (_req, res) => {
  const result = await db.raw(`
    UPDATE dim_regra_empenho r
    SET fk_credor = f.fk_credor
    FROM fact_ordem_pagamento f
    WHERE f.num_empenho_base = r.num_empenho_base
      AND r.fk_credor != f.fk_credor
  `);
  res.json({ affected: result.rowCount });
});
router.get('/admin/debug-regras', async (_req, res) => {
  const regras = await db('dim_regra_empenho as r')
    .select('r.*', 'c.nome as credor_nome')
    .leftJoin('dim_credor as c', 'r.fk_credor', 'c.id');
  const sample = await db('fact_ordem_pagamento as f')
    .select('f.id', 'f.num_empenho', 'f.num_empenho_base', 'f.fk_credor')
    .where('f.num_empenho', 'like', '23/%')
    .limit(5);
  res.json({ regras, sample });
});
router.post('/admin/drop-regra-empenho', async (_req, res) => {
  await db.raw('DROP TABLE IF EXISTS dim_regra_empenho');
  res.json({ ok: true });
});

// Reset do super admin — sem autenticação (usar só em setup/emergência)
router.get('/admin/reset-super-admin', async (_req, res) => {
  try {
    const bcrypt = await import('bcryptjs');
    const senha_hash = await bcrypt.hash('Admin@2025!', 12);

    // Verifica se a coluna fk_municipio já existe na tabela usuarios
    const temColuna = await db.schema.hasColumn('usuarios', 'fk_municipio');

    const base: Record<string, any> = {
      nome: 'Administrador',
      email: 'admin@prefeitura.gov.br',
      senha_hash,
      role: 'SUPER_ADMIN',
      ativo: true,
    };
    if (temColuna) {
      base.fk_municipio = null;
      base.fk_entidade = null;
    }

    const exists = await db('usuarios').where({ email: 'admin@prefeitura.gov.br' }).first();
    if (exists) {
      await db('usuarios').where({ email: 'admin@prefeitura.gov.br' }).update({ role: 'SUPER_ADMIN', ativo: true, senha_hash });
    } else {
      await db('usuarios').insert({ ...base, criado_em: new Date() });
    }

    // Migra qualquer ADMIN antigo para SUPER_ADMIN
    await db('usuarios').where({ role: 'ADMIN' }).update({ role: 'SUPER_ADMIN' });

    res.send(`
      <html><body style="font-family:sans-serif;padding:40px;background:#0f172a;color:#fff">
        <h2 style="color:#fbbf24">✅ Super Admin resetado com sucesso!</h2>
        <p>Email: <b>admin@prefeitura.gov.br</b></p>
        <p>Senha: <b>Admin@2025!</b></p>
        <p style="color:#94a3b8">Agora faça login no sistema. Este endpoint pode ser removido após o setup.</p>
        <a href="http://localhost:3000" style="color:#fbbf24">→ Ir para o sistema</a>
      </body></html>
    `);
  } catch (err: any) {
    res.status(500).send(`<pre style="color:red">${err.message}</pre>`);
  }
});

router.get('/elementos-despesa', authMiddleware, async (_req, res) => {
  const rows = await db('dim_elemento_despesa').select('id', 'codigo', 'descricao').orderBy('codigo');
  res.json(rows);
});

router.get('/fontes-recurso', authMiddleware, async (_req, res) => {
  const rows = await db('dim_fonte_recurso').select('id', 'codigo', 'descricao').orderBy('codigo');
  res.json(rows);
});

// Fix sequences dessincronizadas (usar uma vez em emergência)
router.get('/admin/fix-sequences', async (_req, res) => {
  try {
    const tables = [
      'dim_subgrupo_despesa',
      'dim_grupo_despesa',
      'dim_credor',
      'dim_credor_a_pagar',
      'fact_ordem_pagamento',
      'import_jobs',
      'usuarios',
      'dim_municipio',
      'dim_entidade',
    ];
    const results: Record<string, number> = {};
    for (const table of tables) {
      try {
        const seq = `${table}_id_seq`;
        await db.raw(`SELECT setval('${seq}', COALESCE((SELECT MAX(id) FROM "${table}"), 0) + 1, false)`);
        const row = await db.raw(`SELECT last_value FROM "${seq}"`);
        results[table] = row.rows[0]?.last_value;
      } catch { results[table] = -1; }
    }
    res.json({ ok: true, sequences: results });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Resumo Bancário ───────────────────────────────────────────────────────────
router.get('/resumo-bancario', authMiddleware, async (req, res) => {
  try {
    const { municipioId, entidadeId } = req.query as Record<string, string>;
    const user = (req as any).user;

    const q = db('fact_resumo_bancario as r')
      .join('dim_entidade as e', 'r.fk_entidade', 'e.id')
      .select(
        'r.periodo_ref', 'r.ano', 'r.mes',
        'e.id as entidade_id', 'e.nome as entidade_nome',
        db.raw('SUM(r.saldo_anterior) as saldo_anterior'),
        db.raw('SUM(r.creditos) as creditos'),
        db.raw('SUM(r.debitos) as debitos'),
        db.raw('SUM(r.saldo_atual) as saldo_atual'),
      )
      .groupBy('r.periodo_ref', 'r.ano', 'r.mes', 'e.id', 'e.nome')
      .orderBy('r.periodo_ref');

    if (entidadeId) q.where('r.fk_entidade', entidadeId);
    else if (municipioId) q.where('r.fk_municipio', municipioId);
    else if (user?.fk_municipio) q.where('r.fk_municipio', user.fk_municipio);

    const rows = await q;
    res.json(rows.map((r: any) => ({
      ...r,
      saldo_anterior: Number(r.saldo_anterior ?? 0),
      creditos:       Number(r.creditos ?? 0),
      debitos:        Number(r.debitos ?? 0),
      saldo_atual:    Number(r.saldo_atual ?? 0),
    })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/resumo-bancario/detalhado', authMiddleware, async (req, res) => {
  try {
    const { municipioId, entidadeId, periodoRef } = req.query as Record<string, string>;
    const user = (req as any).user;

    const q = db('fact_resumo_bancario as r')
      .join('dim_entidade as e', 'r.fk_entidade', 'e.id')
      .select('r.*', 'e.nome as entidade_nome')
      .orderBy('r.nome_conta');

    if (periodoRef) q.where('r.periodo_ref', periodoRef);
    if (entidadeId) q.where('r.fk_entidade', entidadeId);
    else if (municipioId) q.where('r.fk_municipio', municipioId);
    else if (user?.fk_municipio) q.where('r.fk_municipio', user.fk_municipio);

    res.json(await q);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Credores a Pagar ──────────────────────────────────────────────────────────
router.get('/credores-a-pagar',           authMiddleware, listCredoresAPagar);
router.patch('/credores-a-pagar/:id',     authMiddleware, classificarCredorAPagar);
router.post('/credores-a-pagar/lote',     authMiddleware, classificarLoteCredoresAPagar);
router.get('/credores-a-pagar/opcoes',    authMiddleware, getGruposSubgrupos);
router.delete('/credores-a-pagar',        authMiddleware, deleteAllCredoresAPagar);

export default router;
