import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { listSecretarias, createSecretaria, updateSecretaria, deleteSecretaria, listEntidadesParaSecretaria } from '../controllers/secretarias.controller';

const router = Router();
router.use(authMiddleware);

router.get('/entidades/list', listEntidadesParaSecretaria);
router.get('/', listSecretarias);
router.post('/', createSecretaria);
router.put('/:id', updateSecretaria);
router.delete('/:id', deleteSecretaria);

export default router;
