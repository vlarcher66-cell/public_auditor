import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { getDespesaReal, getMetas, saveMetas, getExecutado, getEntidadesFiltro, getFarol } from '../controllers/metas.controller';

const router = Router();
router.use(authMiddleware);

router.get('/farol', getFarol);
router.get('/despesa-real', getDespesaReal);
router.get('/executado', getExecutado);
router.get('/entidades', getEntidadesFiltro);
router.get('/', getMetas);
router.post('/', saveMetas);

export default router;
