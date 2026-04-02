import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import {
  getMatrizEmpenhos,
  getResumoAPagar,
  getEmpenhosPendentes,
  getPeriodos,
  getTopCredores,
  getAging,
  getEvolucao,
  getListagem,
} from '../controllers/empenhoLiquidado.controller';

const router = Router();
router.use(authMiddleware);

router.get('/matriz',        getMatrizEmpenhos);
router.get('/resumo',        getResumoAPagar);
router.get('/pendentes',     getEmpenhosPendentes);
router.get('/periodos',      getPeriodos);
router.get('/listagem',      getListagem);
router.get('/top-credores',  getTopCredores);
router.get('/aging',         getAging);
router.get('/evolucao',      getEvolucao);

export default router;
