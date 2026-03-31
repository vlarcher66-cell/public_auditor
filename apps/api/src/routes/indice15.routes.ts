import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { getIndice15 } from '../controllers/indice15.controller';

const router = Router();
router.use(authMiddleware);
router.get('/', getIndice15);

export default router;
