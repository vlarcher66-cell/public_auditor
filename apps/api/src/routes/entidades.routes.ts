import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { listEntidades, createEntidade, updateEntidade, deleteEntidade } from '../controllers/entidades.controller';

const router = Router();
router.use(authMiddleware);

router.get('/', listEntidades);
router.post('/', createEntidade);
router.put('/:id', updateEntidade);
router.delete('/:id', deleteEntidade);

export default router;
