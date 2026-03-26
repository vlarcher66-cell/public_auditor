import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { listarRegras, salvarRegra, deletarRegra } from '../controllers/regraEmpenho.controller';

const router = Router();
router.use(authMiddleware);

router.get('/', listarRegras);
router.post('/', salvarRegra);
router.delete('/:id', deletarRegra);

export default router;
