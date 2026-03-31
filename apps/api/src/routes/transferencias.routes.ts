import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { listTransferencias, getTransferenciaSummary, getTransferenciaDRE } from '../controllers/transferencias.controller';

const router = Router();

router.use(authMiddleware);

router.get('/',        listTransferencias);
router.get('/dre',     getTransferenciaDRE);
router.get('/summary', getTransferenciaSummary);

export default router;
