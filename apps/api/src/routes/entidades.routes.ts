import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { listEntidades, createEntidade, updateEntidade, deleteEntidade, listEntidadesSimples } from '../controllers/entidades.controller';

const router = Router();
router.use(authMiddleware);

router.get('/list', listEntidadesSimples);
router.get('/', listEntidades);
router.post('/', createEntidade);
router.put('/:id', updateEntidade);
router.delete('/:id', deleteEntidade);

export default router;
