import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { listPagamentos, getSummary, getCardStats, exportPagamentos, classificarPagamento, getSinteticaMensal, getSinteticaFiltros, autoClassificarSetores, getPorSetor, backfillEmpenhoBase, getAnaliticaMensal, backfillSubgrupoPrefixado, getDiarias, autoClassificarDiarias, getOutrosExercicios, getOutrosExerciciosProcessos } from '../controllers/pagamentos.controller';
import { listRateio, saveRateio, getTemplate } from '../controllers/rateio.controller';
import { listRegras, saveRegra, deleteRegra, getRegra } from '../controllers/classificacaoEmpenho.controller';

const router = Router();

router.use(authMiddleware);

router.get('/', listPagamentos);
router.get('/summary', getSummary);
router.get('/stats', getCardStats);
router.get('/export', exportPagamentos);
router.get('/sintetica-mensal', getSinteticaMensal);
router.get('/sintetica-filtros', getSinteticaFiltros);
router.get('/analitica-mensal', getAnaliticaMensal);
router.get('/diarias', getDiarias);
router.get('/outros-exercicios', getOutrosExercicios);
router.get('/outros-exercicios/processos', getOutrosExerciciosProcessos);
router.get('/por-setor', getPorSetor);
router.post('/auto-classificar-setores', autoClassificarSetores);
router.post('/auto-classificar-diarias', autoClassificarDiarias);
router.post('/backfill-subgrupo-prefixado', backfillSubgrupoPrefixado);
router.put('/:id/classificar', classificarPagamento);
router.get('/rateio-template', getTemplate);
router.get('/:id/rateio', listRateio);
router.put('/:id/rateio', saveRateio);

// Regras de classificação automática por empenho
router.get('/credores/:credorId/regras-empenho', listRegras);
router.get('/credores/:credorId/regras-empenho/:empenhoBase', getRegra);
router.post('/credores/:credorId/regras-empenho', saveRegra);
router.delete('/regras-empenho/:id', deleteRegra);

export default router;
