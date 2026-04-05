import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { listUsuarios, createUsuario, updateUsuario, changePassword, deleteUsuario, getPermissoes, savePermissoes } from '../controllers/usuarios.controller';

const router = Router();
router.use(authMiddleware);

router.get('/', listUsuarios);
router.post('/', createUsuario);
router.put('/:id', updateUsuario);
router.patch('/:id/senha', changePassword);
router.get('/:id/permissoes', getPermissoes);
router.put('/:id/permissoes', savePermissoes);
router.delete('/:id', deleteUsuario);

export default router;
