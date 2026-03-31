import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { listReceitas, getReceitaSummary, getReceitaDRE } from '../controllers/receitas.controller';

const router = Router();

router.use(authMiddleware);

router.get('/', listReceitas);
router.get('/summary', getReceitaSummary);
router.get('/dre', getReceitaDRE);

export default router;
