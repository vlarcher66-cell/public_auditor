import { Router } from 'express';
import { listSetores, createSetor, updateSetor, deleteSetor, listBlocosParaSetor } from '../controllers/setores.controller';
import { listSecretariasParaSetor } from '../controllers/secretarias.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(authMiddleware);

// Setores
router.get('/', listSetores);
router.post('/', createSetor);
router.put('/:id', updateSetor);
router.delete('/:id', deleteSetor);

// Blocos (read-only)
router.get('/blocos/list', listBlocosParaSetor);
// Secretarias (read-only para dropdown)
router.get('/secretarias/list', listSecretariasParaSetor);

export default router;
