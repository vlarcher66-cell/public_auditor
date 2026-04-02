import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { getRelatorioQuadrimestral } from '../controllers/relatorioQuadrimestral.controller';

const router = Router();
router.use(authMiddleware);
router.get('/', getRelatorioQuadrimestral);

export default router;
