import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import { logger } from './config/logger';
import { errorMiddleware } from './middleware/error.middleware';
import routes from './routes';

const app = express();

app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
}));

app.use('/api', routes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use(errorMiddleware);

const PORT = env.API_PORT;
app.listen(PORT, async () => {
  logger.info(`🚀 API rodando em http://localhost:${PORT}`);

  // Warm-up: pré-aquece as queries mais comuns para eliminar lentidão na primeira visita
  try {
    const { db } = await import('./config/database');
    await Promise.all([
      db('fact_ordem_pagamento').count('id as n').first(),
      db('dim_credor').select('id', 'nome', 'fk_grupo').limit(1),
      db('dim_grupo_despesa').select('id', 'nome').limit(1),
      db('dim_entidade').select('id', 'nome').limit(1),
      db('fact_ordem_pagamento').select('data_pagamento').orderBy('data_pagamento', 'desc').limit(1),
    ]);
    logger.info('✅ Warm-up do banco concluído');
  } catch (_) {
    // silencioso — warm-up é opcional
  }
});

export default app;
