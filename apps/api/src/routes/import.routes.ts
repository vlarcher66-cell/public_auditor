import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { upload } from '../middleware/upload.middleware';
import { uploadFile, listJobs, getJob, cancelJob, deleteJob, backfillHistorico } from '../controllers/import.controller';

const router = Router();

router.use(authMiddleware);

router.post('/upload', upload.single('file'), uploadFile);
router.post('/backfill-historico', backfillHistorico);
router.get('/jobs', listJobs);
router.get('/jobs/:uuid', getJob);
router.patch('/jobs/:uuid/cancel', cancelJob);
router.delete('/jobs/:uuid', deleteJob);

export default router;
