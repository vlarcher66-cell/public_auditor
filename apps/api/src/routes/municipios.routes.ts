import { Router } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth.middleware';
import {
  listMunicipios,
  getMunicipio,
  createMunicipio,
  updateMunicipio,
  deleteMunicipio,
  listMunicipiosSimples,
} from '../controllers/municipios.controller';

const router = Router();

router.use(authMiddleware);

// Lista simples para dropdowns (qualquer autenticado)
router.get('/list', listMunicipiosSimples);

// CRUD completo — apenas SUPER_ADMIN
router.get('/', requireRole('SUPER_ADMIN'), listMunicipios);
router.get('/:id', requireRole('SUPER_ADMIN'), getMunicipio);
router.post('/', requireRole('SUPER_ADMIN'), createMunicipio);
router.put('/:id', requireRole('SUPER_ADMIN'), updateMunicipio);
router.delete('/:id', requireRole('SUPER_ADMIN'), deleteMunicipio);

export default router;
