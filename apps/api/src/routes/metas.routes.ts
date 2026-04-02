import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { getDespesaReal, getMetas, saveMetas, getExecutado, getEntidadesFiltro } from '../controllers/metas.controller';

const router = Router();
router.use(authMiddleware);

router.get('/despesa-real', getDespesaReal);
router.get('/executado', getExecutado);
router.get('/entidades', getEntidadesFiltro);
router.get('/', getMetas);
router.post('/', saveMetas);

export default router;
