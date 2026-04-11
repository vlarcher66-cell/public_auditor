/**
 * Simple in-process async job runner (no Redis/BullMQ needed).
 * Jobs run asynchronously in the background after the HTTP response is sent.
 */
import { db } from '../config/database';
import { runETL } from '../etl';
import { logger } from '../config/logger';
import { classificarTodosCredoresDiarias } from '../services/diariasClassificacao.service';
import { extractReceitaFromPdf } from '../etl/extractors/receita.extractor';
import { extractReceitaFromExcel } from '../etl/extractors/receitaExcel.extractor';
import { loadReceitaToMySQL } from '../etl/loaders/receita.loader';
import { extractTransfBancariaFromPdf } from '../etl/extractors/transferenciaBancaria.extractor';
import { extractTransfBancariaFromExcel } from '../etl/extractors/transferenciaBancariaExcel.extractor';
import { loadTransfBancariaToMySQL } from '../etl/loaders/transferenciaBancaria.loader';
import { extractEmpenhoLiquidadoFromExcel } from '../etl/extractors/empenhoLiquidado.extractor';
import { loadEmpenhoLiquidadoToMySQL } from '../etl/loaders/empenhoLiquidado.loader';
import { extractResumoBancarioFromExcel } from '../etl/extractors/resumoBancario.extractor';
import { loadResumoBancario } from '../etl/loaders/resumoBancario.loader';

export interface ETLJobData {
  importJobId: number;
  filePath: string;
  tipoRelatorio?: string;
  entidadeId?: number;
  periodoReferencia?: string;
}

export function enqueueETLJob(data: ETLJobData): void {
  // Fire-and-forget: runs after current event loop tick
  setImmediate(() => processJob(data));
}

async function processJob({ importJobId, filePath, tipoRelatorio, entidadeId, periodoReferencia }: ETLJobData): Promise<void> {
  logger.info({ importJobId, tipoRelatorio }, 'ETL: starting');

  // ── Transferência Bancária: pipeline dedicado ───────────────────────────────
  if (tipoRelatorio === 'TRANSF_BANCARIA') {
    try {
      await db('import_jobs').where({ id: importJobId }).update({
        status: 'EXTRACTING',
        started_at: new Date().toISOString(),
      });

      const isXlsx = /\.(xlsx|xls)$/i.test(filePath);
      const rawRows = isXlsx
        ? extractTransfBancariaFromExcel(filePath)
        : await extractTransfBancariaFromPdf(filePath);
      logger.info({ count: rawRows.length, isXlsx }, 'TransfBancaria ETL: extracted');

      await db('import_jobs').where({ id: importJobId }).update({
        status: 'LOADING',
        total_rows: rawRows.length,
      });

      const result = await loadTransfBancariaToMySQL(
        db, rawRows, importJobId,
        entidadeId!,
        periodoReferencia || 'Janeiro/2026',
      );

      await db('import_jobs').where({ id: importJobId }).update({
        status: 'DONE',
        total_rows: rawRows.length,
        rows_loaded: result.rows_loaded,
        rows_skipped: result.rows_skipped,
        rows_errored: 0,
        valor_bruto_total: result.valor_total,
        finished_at: new Date().toISOString(),
      });

      logger.info({ importJobId, ...result }, 'TransfBancaria ETL: done');
    } catch (err: any) {
      logger.error({ importJobId, err: err.message }, 'TransfBancaria ETL: failed');
      await db('import_jobs').where({ id: importJobId }).update({
        status: 'ERROR',
        error_log: JSON.stringify([{ row_index: -1, field: 'system', message: err.message, raw_value: '' }]),
        finished_at: new Date().toISOString(),
      });
    }
    return;
  }

  // ── Empenho Liquidado (Contas a Pagar): pipeline dedicado ───────────────────
  if (tipoRelatorio === 'EMPENHO_LIQUIDADO') {
    try {
      await db('import_jobs').where({ id: importJobId }).update({
        status: 'EXTRACTING',
        started_at: new Date().toISOString(),
      });

      const rawRows = extractEmpenhoLiquidadoFromExcel(filePath);
      logger.info({ count: rawRows.length }, 'EmpenhoLiquidado ETL: extracted');

      await db('import_jobs').where({ id: importJobId }).update({
        status: 'LOADING',
        total_rows: rawRows.length,
      });

      const result = await loadEmpenhoLiquidadoToMySQL(
        db, rawRows, importJobId,
        entidadeId!,
        periodoReferencia || '',
      );

      await db('import_jobs').where({ id: importJobId }).update({
        status: 'DONE',
        total_rows: rawRows.length,
        rows_loaded: result.rows_loaded,
        rows_skipped: result.rows_skipped,
        rows_errored: 0,
        valor_bruto_total: result.valor_total,
        finished_at: new Date().toISOString(),
      });

      logger.info({ importJobId, ...result }, `EmpenhoLiquidado ETL: done — ${result.credores_criados} credor(es) criado(s) automaticamente`);
    } catch (err: any) {
      logger.error({ importJobId, err: err.message }, 'EmpenhoLiquidado ETL: failed');
      await db('import_jobs').where({ id: importJobId }).update({
        status: 'ERROR',
        error_log: JSON.stringify([{ row_index: -1, field: 'system', message: err.message, raw_value: '' }]),
        finished_at: new Date().toISOString(),
      });
    }
    return;
  }

  // ── Resumo Bancário: pipeline dedicado ─────────────────────────────────────
  if (tipoRelatorio === 'RESUMO_BANCARIO') {
    try {
      await db('import_jobs').where({ id: importJobId }).update({ status: 'EXTRACTING', started_at: new Date().toISOString() });

      const rawRows = extractResumoBancarioFromExcel(filePath);
      logger.info({ count: rawRows.length }, 'ResumoBancario ETL: extracted');

      await db('import_jobs').where({ id: importJobId }).update({ status: 'LOADING', total_rows: rawRows.length });

      const result = await loadResumoBancario(db, rawRows, importJobId, entidadeId!, periodoReferencia || '');

      await db('import_jobs').where({ id: importJobId }).update({
        status: 'DONE',
        total_rows: rawRows.length,
        rows_loaded: result.rows_loaded,
        rows_skipped: result.rows_skipped,
        rows_errored: 0,
        valor_bruto_total: result.valor_total,
        finished_at: new Date().toISOString(),
      });

      logger.info({ importJobId, ...result }, 'ResumoBancario ETL: done');
    } catch (err: any) {
      logger.error({ importJobId, err: err.message }, 'ResumoBancario ETL: failed');
      await db('import_jobs').where({ id: importJobId }).update({
        status: 'ERROR',
        error_log: JSON.stringify([{ row_index: -1, field: 'system', message: err.message, raw_value: '' }]),
        finished_at: new Date().toISOString(),
      });
    }
    return;
  }

  // ── Receita: pipeline dedicado ──────────────────────────────────────────────
  if (tipoRelatorio === 'RECEITA') {
    try {
      await db('import_jobs').where({ id: importJobId }).update({
        status: 'EXTRACTING',
        started_at: new Date().toISOString(),
      });

      const isXlsx = /\.(xlsx|xls)$/i.test(filePath);
      const rawRows = isXlsx
        ? extractReceitaFromExcel(filePath)
        : await extractReceitaFromPdf(filePath);
      logger.info({ count: rawRows.length, isXlsx }, 'Receita ETL: extracted');

      await db('import_jobs').where({ id: importJobId }).update({
        status: 'LOADING',
        total_rows: rawRows.length,
      });

      const result = await loadReceitaToMySQL(
        db, rawRows, importJobId,
        entidadeId!,
        periodoReferencia || 'Janeiro/2026',
      );

      await db('import_jobs').where({ id: importJobId }).update({
        status: 'DONE',
        total_rows: rawRows.length,
        rows_loaded: result.rows_loaded,
        rows_skipped: result.rows_skipped,
        rows_errored: 0,
        valor_bruto_total: result.valor_total,
        finished_at: new Date().toISOString(),
      });

      logger.info({ importJobId, ...result }, 'Receita ETL: done');
    } catch (err: any) {
      logger.error({ importJobId, err: err.message }, 'Receita ETL: failed');
      await db('import_jobs').where({ id: importJobId }).update({
        status: 'ERROR',
        error_log: JSON.stringify([{ row_index: -1, field: 'system', message: err.message, raw_value: '' }]),
        finished_at: new Date().toISOString(),
      });
    }
    return;
  }

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

    // Auto-classify daily allowance creditors (element 3.3.90.14)
    const credoresBasicosAtualizados = await autoClassificarCredoresDiarias();

    // Classify creditors by historical pattern analysis (keywords)
    const classificacaoIA = await classificarTodosCredoresDiarias();

    logger.info(
      {
        importJobId,
        ...result,
        credoresBasicosAtualizados,
        classificacaoIA
      },
      'ETL: done com auto-classificação de diárias'
    );
  } catch (err: any) {
    logger.error({ importJobId, err: err.message }, 'ETL: failed');
    await db('import_jobs').where({ id: importJobId }).update({
      status: 'ERROR',
      error_log: JSON.stringify([{ row_index: -1, field: 'system', message: err.message, raw_value: '' }]),
      finished_at: new Date().toISOString(),
    });
  }
}

async function autoClassificarCredoresDiarias(): Promise<number> {
  // Busca o grupo "Diária" dinamicamente
  const grupoDiaria = await db('dim_grupo_despesa')
    .where('nome', 'like', '%DIÁRIA%')
    .orWhere('nome', 'like', '%DIARIA%')
    .first();

  if (!grupoDiaria) {
    logger.warn('Grupo "Diária" não encontrado no banco de dados');
    return 0;
  }

  // Credores sem grupo que:
  // (a) têm pelo menos um pagamento com elemento 3.3.90.14, OU
  // (b) têm histórico de pagamento que menciona diária
  const credores = await db('dim_credor as c')
    .whereNull('c.fk_grupo')
    .where((w) => {
      w.whereExists(
        db('fact_ordem_pagamento as f')
          .join('dim_elemento_despesa as el', 'f.fk_elemento_despesa', 'el.id')
          .where('f.fk_credor', db.raw('c.id'))
          .where('el.codigo', 'like', '3.3.90.14%')
          .select(db.raw('1'))
      )
      .orWhere('c.historico', 'like', '%DIÁRI%')
      .orWhere('c.historico', 'like', '%DIARIA%');
    })
    .select('c.id');

  if (credores.length === 0) return 0;

  const ids = credores.map((c: any) => c.id);
  await db('dim_credor').whereIn('id', ids).update({ fk_grupo: grupoDiaria.id, precisa_reclassificacao: false });

  return ids.length;
}
