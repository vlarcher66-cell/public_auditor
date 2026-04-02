import { Request, Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../config/database';
import { enqueueETLJob } from '../jobs/jobQueue';
import { logger } from '../config/logger';
import { extractFromExcel } from '../etl/extractors/excel.extractor';
import { extractFromPdf } from '../etl/extractors/pdf.extractor';
import { transformOrdemPagamento, normalizeCnpjCpf } from '../etl/transformers/ordemPagamento.transformer';
import { env } from '../config/env';

export async function uploadFile(req: Request, res: Response): Promise<void> {
  if (!req.file) {
    res.status(400).json({ error: 'Nenhum arquivo enviado' });
    return;
  }

  const ext = path.extname(req.file.originalname).toLowerCase();
  const fileType = ext === '.pdf' ? 'PDF' : ext === '.csv' ? 'CSV' : 'XLSX';
  const uuid = uuidv4();
  const tipoRaw = String(req.body.tipo_relatorio || 'OR').toUpperCase();
  const tipoRelatorio = tipoRaw === 'RP' ? 'RP'
    : tipoRaw === 'RECEITA' ? 'RECEITA'
    : tipoRaw === 'TRANSF_BANCARIA' ? 'TRANSF_BANCARIA'
    : tipoRaw === 'EMPENHO_LIQUIDADO' ? 'EMPENHO_LIQUIDADO'
    : 'OR';
  const entidadeId = req.body.entidade_id ? parseInt(req.body.entidade_id) : undefined;
  const sistemaOrigem = req.body.sistema_origem ? String(req.body.sistema_origem).slice(0, 50) : null;
  const periodoReferencia = req.body.periodo ? String(req.body.periodo).slice(0, 20) : undefined;

  // Validate entidade if provided
  if (entidadeId) {
    const entidade = await db('dim_entidade').where('id', entidadeId).first();
    if (!entidade) {
      res.status(400).json({ error: 'Entidade não encontrada' });
      return;
    }
  }

  const [id] = await db('import_jobs').insert({
    uuid,
    filename: req.file.originalname,
    file_type: fileType,
    file_size_bytes: req.file.size,
    status: 'QUEUED',
    tipo_relatorio: tipoRelatorio,
    sistema_origem: sistemaOrigem,
    fk_usuario: req.user!.sub,
    criado_em: new Date().toISOString(),
  });

  // Start ETL asynchronously (no Redis needed)
  enqueueETLJob({ importJobId: id, filePath: req.file.path, tipoRelatorio, entidadeId, periodoReferencia });

  logger.info({ uuid, filename: req.file.originalname }, 'Import job queued');

  res.status(202).json({ uuid, jobId: id, filename: req.file.originalname, fileType, status: 'QUEUED' });
}

export async function listJobs(req: Request, res: Response): Promise<void> {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, parseInt(req.query.limit as string) || 20);
  const offset = (page - 1) * limit;
  const status = req.query.status as string | undefined;
  const tipo   = req.query.tipo   as string | undefined;

  let query = db('import_jobs')
    .join('usuarios', 'import_jobs.fk_usuario', 'usuarios.id')
    .select('import_jobs.*', 'usuarios.nome as usuario_nome')
    .orderBy('import_jobs.criado_em', 'desc')
    .limit(limit)
    .offset(offset);

  let countQuery = db('import_jobs').count('* as total');

  if (status) {
    query      = query.where('import_jobs.status', status);
    countQuery = countQuery.where('status', status);
  }
  if (tipo === 'DESPESA') {
    query      = query.whereIn('import_jobs.tipo_relatorio', ['OR', 'RP']);
    countQuery = countQuery.whereIn('tipo_relatorio', ['OR', 'RP']);
  } else if (tipo) {
    query      = query.where('import_jobs.tipo_relatorio', tipo);
    countQuery = countQuery.where('tipo_relatorio', tipo);
  }

  const [jobs, countRows] = await Promise.all([query, countQuery]);
  const total = (countRows[0] as any).total;

  res.json({ jobs, total: Number(total), page, limit });
}

export async function getJob(req: Request, res: Response): Promise<void> {
  const job = await db('import_jobs').where({ uuid: req.params.uuid }).first();

  if (!job) {
    res.status(404).json({ error: 'Job não encontrado' });
    return;
  }

  if (job.error_log && typeof job.error_log === 'string') {
    try { job.error_log = JSON.parse(job.error_log); } catch { /* keep as-is */ }
  }

  res.json(job);
}

export async function cancelJob(req: Request, res: Response): Promise<void> {
  const job = await db('import_jobs').where({ uuid: req.params.uuid }).first();
  if (!job) { res.status(404).json({ error: 'Job não encontrado' }); return; }
  if (job.status !== 'QUEUED') { res.status(409).json({ error: 'Apenas jobs QUEUED podem ser cancelados' }); return; }
  await db('import_jobs').where({ id: job.id }).update({ status: 'ERROR', finished_at: new Date().toISOString() });
  res.json({ message: 'Job cancelado' });
}

export async function backfillHistorico(_req: Request, res: Response): Promise<void> {
  try {
    const uploadDir = path.resolve(env.UPLOAD_DIR);
    const files = fs.readdirSync(uploadDir).filter((f) => /\.(xlsx|xls|pdf)$/i.test(f));

    // Build map: cnpj_cpf_norm → first historico found across all files
    const credorHistoricoMap = new Map<string, string>();

    for (const file of files) {
      const filePath = path.join(uploadDir, file);
      try {
        const isPdf = /\.pdf$/i.test(file);
        const rawRows = isPdf ? await extractFromPdf(filePath) : extractFromExcel(filePath);
        for (const r of rawRows) {
          if (!r.historico || !r.cnpj_cpf) continue;
          const norm = normalizeCnpjCpf(r.cnpj_cpf);
          if (norm && !credorHistoricoMap.has(norm)) {
            credorHistoricoMap.set(norm, r.historico.trim());
          }
        }
      } catch (err: any) {
        logger.warn({ file, err: err.message }, 'Backfill: skipped file');
      }
    }

    // Update dim_credor directly by cnpj_cpf_norm
    let credorUpdated = 0;
    for (const [norm, historico] of credorHistoricoMap) {
      const n = await db('dim_credor')
        .where('cnpj_cpf_norm', norm)
        .where((q) => q.whereNull('historico').orWhere('historico', ''))
        .update({ historico });
      credorUpdated += n;
    }

    // Also update fact_ordem_pagamento if any rows exist
    let factUpdated = 0;
    for (const file of files) {
      const filePath = path.join(uploadDir, file);
      try {
        const rawRows = extractFromExcel(filePath);
        const transformed = rawRows
          .map((r) => { try { return transformOrdemPagamento(r); } catch { return null; } })
          .filter(Boolean) as ReturnType<typeof transformOrdemPagamento>[];
        for (const t of transformed) {
          if (!t.historico) continue;
          const n = await db('fact_ordem_pagamento')
            .where('hash_linha', t.hash_linha)
            .where((q) => q.whereNull('historico').orWhere('historico', ''))
            .update({ historico: t.historico });
          factUpdated += n;
        }
      } catch { /* skip */ }
    }

    res.json({ ok: true, files_processed: files.length, credores_updated: credorUpdated, fact_rows_updated: factUpdated });
  } catch (err: any) {
    logger.error({ err: err.message }, 'Backfill error');
    res.status(500).json({ error: err.message });
  }
}

export async function deleteJob(req: Request, res: Response): Promise<void> {
  const job = await db('import_jobs').where({ uuid: req.params.uuid }).first();
  if (!job) { res.status(404).json({ error: 'Job não encontrado' }); return; }

  await db.transaction(async (trx) => {
    // Remove registros de despesa ou receita vinculados a este job
    const deletedDespesa   = await trx('fact_ordem_pagamento').where({ fk_import_job: job.id }).delete();
    const deletedReceita   = await trx('fact_receita').where({ fk_import_job: job.id }).delete();
    const deletedTransfer  = await trx('fact_transf_bancaria').where({ fk_import_job: job.id }).delete();
    const deletedEmpenhos  = await trx('fact_empenho_liquidado').where({ fk_import_job: job.id }).delete();
    await trx('import_jobs').where({ id: job.id }).delete();
    logger.info({ jobId: job.id, uuid: job.uuid, deletedDespesa, deletedReceita, deletedTransfer, deletedEmpenhos }, 'Import job deleted');
  });

  res.json({ message: 'Importação e registros excluídos com sucesso' });
}
