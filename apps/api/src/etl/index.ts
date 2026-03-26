import * as path from 'path';
import type { Knex } from 'knex';
import type { ImportErrorEntry } from '@public-auditor/shared';

import { extractFromPdf } from './extractors/pdf.extractor';
import { extractFromExcel } from './extractors/excel.extractor';
import { transformOrdemPagamento } from './transformers/ordemPagamento.transformer';
import { validateRows } from './validators/ordemPagamento.validator';
import { loadToMySQL } from './loaders/mysql.loader';
import { logger } from '../config/logger';

export interface ETLResult {
  total_rows: number;
  rows_loaded: number;
  rows_skipped: number;
  rows_errored: number;
  valor_bruto_total: number;
  error_log: ImportErrorEntry[];
}

export async function runETL(
  db: Knex,
  filePath: string,
  importJobId: number,
  onProgress?: (status: string, loaded?: number, total?: number) => Promise<void>,
  tipoRelatorio: string = 'OR',
  entidadeId?: number,
): Promise<ETLResult> {
  const ext = path.extname(filePath).toLowerCase();

  // Stage 1: Extract
  await onProgress?.('EXTRACTING');
  logger.info({ filePath, ext }, 'ETL: Extracting');

  let rawRows;
  try {
    if (ext === '.pdf') {
      rawRows = await extractFromPdf(filePath);
    } else if (['.xlsx', '.xls'].includes(ext)) {
      rawRows = extractFromExcel(filePath);
    } else {
      throw new Error(`Tipo de arquivo não suportado: ${ext}`);
    }
  } catch (err) {
    logger.error({ err }, 'ETL: Extraction failed');
    throw err;
  }

  logger.info({ count: rawRows.length }, 'ETL: Extracted rows');

  // Stage 2 & 3: Transform
  await onProgress?.('TRANSFORMING');

  const transformedRows = [];
  const transformErrors: ImportErrorEntry[] = [];

  for (let i = 0; i < rawRows.length; i++) {
    try {
      const transformed = transformOrdemPagamento(rawRows[i]);
      transformedRows.push(transformed);
    } catch (err: any) {
      transformErrors.push({
        row_index: i,
        field: 'transform',
        message: err.message || 'Erro na transformação',
        raw_value: JSON.stringify(rawRows[i]).slice(0, 200),
      });
    }
  }

  // Stage 4: Validate
  const { valid, invalid } = validateRows(transformedRows);

  const validationErrors: ImportErrorEntry[] = invalid.flatMap((inv) => inv.errors);
  const allErrors = [...transformErrors, ...validationErrors];

  logger.info({ valid: valid.length, invalid: invalid.length }, 'ETL: Validation done');

  // Stage 5: Load
  await onProgress?.('LOADING', 0, valid.length);

  let loadResult = { rows_loaded: 0, rows_skipped: 0 };

  if (valid.length > 0) {
    loadResult = await loadToMySQL(db, valid, importJobId, tipoRelatorio, entidadeId);
  }

  // Compute valor_bruto_total from all valid rows
  const valor_bruto_total = valid.reduce((sum, r) => sum + (r.valor_bruto || 0), 0);

  logger.info(loadResult, 'ETL: Load complete');

  return {
    total_rows: rawRows.length,
    rows_loaded: loadResult.rows_loaded,
    rows_skipped: loadResult.rows_skipped,
    rows_errored: transformErrors.length + invalid.length,
    valor_bruto_total: Math.round(valor_bruto_total * 100) / 100,
    error_log: allErrors,
  };
}
