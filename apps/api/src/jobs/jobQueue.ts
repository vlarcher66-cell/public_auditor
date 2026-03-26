/**
 * Simple in-process async job runner (no Redis/BullMQ needed).
 * Jobs run asynchronously in the background after the HTTP response is sent.
 */
import { db } from '../config/database';
import { runETL } from '../etl';
import { logger } from '../config/logger';

export interface ETLJobData {
  importJobId: number;
  filePath: string;
  tipoRelatorio?: string;
  entidadeId?: number;
}

export function enqueueETLJob(data: ETLJobData): void {
  // Fire-and-forget: runs after current event loop tick
  setImmediate(() => processJob(data));
}

async function processJob({ importJobId, filePath, tipoRelatorio, entidadeId }: ETLJobData): Promise<void> {
  logger.info({ importJobId, tipoRelatorio }, 'ETL: starting');

  try {
    await db('import_jobs').where({ id: importJobId }).update({
      status: 'EXTRACTING',
      started_at: new Date().toISOString(),
    });

    const result = await runETL(db, filePath, importJobId, async (status, loaded, total) => {
      await db('import_jobs').where({ id: importJobId }).update({
        status,
        rows_loaded: loaded ?? 0,
        total_rows: total ?? 0,
      });
    }, tipoRelatorio || 'OR', entidadeId);

    await db('import_jobs').where({ id: importJobId }).update({
      status: 'DONE',
      total_rows: result.total_rows,
      rows_loaded: result.rows_loaded,
      rows_skipped: result.rows_skipped,
      rows_errored: result.rows_errored,
      valor_bruto_total: result.valor_bruto_total,
      error_log: result.error_log.length > 0 ? JSON.stringify(result.error_log) : null,
      finished_at: new Date().toISOString(),
    });

    logger.info({ importJobId, ...result }, 'ETL: done');
  } catch (err: any) {
    logger.error({ importJobId, err: err.message }, 'ETL: failed');
    await db('import_jobs').where({ id: importJobId }).update({
      status: 'ERROR',
      error_log: JSON.stringify([{ row_index: -1, field: 'system', message: err.message, raw_value: '' }]),
      finished_at: new Date().toISOString(),
    });
  }
}
