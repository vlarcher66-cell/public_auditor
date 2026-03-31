import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { getSugestoesMM, aplicarMM } from '../controllers/mm.controller';

const router = Router();

router.use(authMiddleware);

router.get('/sugestoes', getSugestoesMM);
router.post('/aplicar', aplicarMM);

export default router;
