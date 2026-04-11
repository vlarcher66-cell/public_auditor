import { Knex } from 'knex';
import { createHash } from 'crypto';
import type { RawResumoBancario } from '../extractors/resumoBancario.extractor';
import { logger } from '../../config/logger';

export interface ResumoBancarioLoadResult {
  rows_loaded: number;
  rows_skipped: number;
  valor_total: number;
}

function hashLinha(row: RawResumoBancario, periodoRef: string, entidadeId: number): string {
  const str = [periodoRef, entidadeId, row.num_ordem, row.nome_conta, String(row.saldo_atual)].join('|');
  return createHash('sha256').update(str).digest('hex');
}

export async function loadResumoBancario(
  db: Knex,
  rows: RawResumoBancario[],
  importJobId: number,
  entidadeId: number,
  periodoRef: string,
): Promise<ResumoBancarioLoadResult> {
  const entidade = await db('dim_entidade').where('id', entidadeId).first();
  if (!entidade) throw new Error(`Entidade id=${entidadeId} não encontrada`);
  const fkMunicipio = entidade.fk_municipio ?? null;

  const [ano, mes] = periodoRef.split('-').map(Number);

  // Reimportação limpa — apaga registros do mesmo período+entidade
  await db('fact_resumo_bancario')
    .where('periodo_ref', periodoRef)
    .where('fk_entidade', entidadeId)
    .delete();

  let rows_loaded = 0;
  let rows_skipped = 0;
  let valor_total = 0;

  for (const row of rows) {
    const hash = hashLinha(row, periodoRef, entidadeId);
    try {
      await db('fact_resumo_bancario').insert({
        num_ordem:      row.num_ordem || null,
        nome_conta:     row.nome_conta,
        saldo_anterior: row.saldo_anterior,
        creditos:       row.creditos,
        debitos:        row.debitos,
        saldo_atual:    row.saldo_atual,
        periodo_ref:    periodoRef,
        ano:            ano || null,
        mes:            mes || null,
        fk_entidade:    entidadeId,
        fk_municipio:   fkMunicipio,
        fk_import_job:  importJobId,
        hash_linha:     hash,
        criado_em:      new Date().toISOString(),
      });
      rows_loaded++;
      valor_total += row.saldo_atual ?? 0;
    } catch (err: any) {
      if (err.message?.includes('UNIQUE')) {
        rows_skipped++;
      } else {
        logger.error({ err: err.message, row }, 'ResumoBancario insert error');
        rows_skipped++;
      }
    }
  }

  return {
    rows_loaded,
    rows_skipped,
    valor_total: Math.round(valor_total * 100) / 100,
  };
}
