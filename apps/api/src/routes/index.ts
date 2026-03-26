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
import { db } from '../config/database';
import { authMiddleware } from '../middleware/auth.middleware';
import { backfillEmpenhoBase } from '../controllers/pagamentos.controller';

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

router.post('/admin/backfill-empenho-base', backfillEmpenhoBase);
router.post('/admin/fix-regra-credor', async (_req, res) => {
  const result = await db.raw(`
    UPDATE dim_regra_empenho r
    JOIN fact_ordem_pagamento f ON f.num_empenho_base = r.num_empenho_base
    SET r.fk_credor = f.fk_credor
    WHERE r.fk_credor != f.fk_credor
    LIMIT 1
  `);
  res.json({ affected: result[0].affectedRows });
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

router.get('/elementos-despesa', authMiddleware, async (_req, res) => {
  const rows = await db('dim_elemento_despesa').select('id', 'codigo', 'descricao').orderBy('codigo');
  res.json(rows);
});

router.get('/fontes-recurso', authMiddleware, async (_req, res) => {
  const rows = await db('dim_fonte_recurso').select('id', 'codigo', 'descricao').orderBy('codigo');
  res.json(rows);
});

export default router;
