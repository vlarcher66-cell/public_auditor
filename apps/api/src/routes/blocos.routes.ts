import { Router } from 'express';
import { listBlocos, createBloco, updateBloco, deleteBloco } from '../controllers/blocos.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/', listBlocos);
router.post('/', createBloco);
router.put('/:id', updateBloco);
router.delete('/:id', deleteBloco);

export default router;
