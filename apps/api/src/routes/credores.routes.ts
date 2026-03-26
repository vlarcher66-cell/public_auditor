import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import {
  listGrupos, createGrupo, updateGrupo, deleteGrupo,
  listSubgrupos, createSubgrupo, updateSubgrupo, deleteSubgrupo,
  listCredores, updateCredor, getCredorStats, deleteAllCredores,
  autoClassificarCredoresDiarias, getCredorClassificacao,
} from '../controllers/credores.controller';

const router = Router();
router.use(authMiddleware);

router.get('/stats', getCredorStats);
router.get('/', listCredores);
router.get('/:id/classificacao', getCredorClassificacao);
router.put('/:id', updateCredor);
router.delete('/', deleteAllCredores);
router.post('/auto-classificar-diarias', autoClassificarCredoresDiarias);

router.get('/grupos', listGrupos);
router.post('/grupos', createGrupo);
router.put('/grupos/:id', updateGrupo);
router.delete('/grupos/:id', deleteGrupo);

router.get('/subgrupos', listSubgrupos);
router.post('/subgrupos', createSubgrupo);
router.put('/subgrupos/:id', updateSubgrupo);
router.delete('/subgrupos/:id', deleteSubgrupo);

export default router;
