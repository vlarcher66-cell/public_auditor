import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { listUsuarios, createUsuario, updateUsuario, changePassword, deleteUsuario } from '../controllers/usuarios.controller';

const router = Router();
router.use(authMiddleware);

router.get('/', listUsuarios);
router.post('/', createUsuario);
router.put('/:id', updateUsuario);
router.patch('/:id/senha', changePassword);
router.delete('/:id', deleteUsuario);

export default router;
