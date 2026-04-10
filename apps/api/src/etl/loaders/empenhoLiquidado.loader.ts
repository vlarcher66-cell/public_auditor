import { Knex } from 'knex';
import { createHash } from 'crypto';
import type { RawEmpenhoLiquidado } from '../extractors/empenhoLiquidado.extractor';
import { logger } from '../../config/logger';

const CHUNK_SIZE = 200;

export interface EmpenhoLiquidadoLoadResult {
  rows_loaded: number;
  rows_skipped: number;
  rows_updated: number;
  valor_total: number;
  valor_a_pagar: number;
  credores_criados: number;
}

function hashEmpenho(row: RawEmpenhoLiquidado, periodoRef: string): string {
  const str = [
    periodoRef,
    row.dt_liquidacao,
    row.num_empenho,
    row.num_reduzido,
    row.credor_nome,
    String(row.valor),
  ].join('|');
  return createHash('sha256').update(str).digest('hex');
}

/**
 * Resolve o credor na ordem:
 * 1. dim_credor (credor já importado com pagamento real)
 * 2. dim_credor_a_pagar (credor de empenhos, já classificado manualmente)
 * 3. Cria novo em dim_credor_a_pagar
 *
 * Retorna { fkCredor, fkCredorAPagar, criado }
 */
async function resolveCredor(
  db: Knex,
  nomeRaw: string,
  fkMunicipio: number | null,
  historico?: string | null,
): Promise<{ fkCredor: number | null; fkCredorAPagar: number | null; criado: boolean }> {
  if (!nomeRaw) throw new Error('Nome do credor vazio');
  const nome = nomeRaw.trim().toUpperCase();

  // 1. Busca em dim_credor (pagamento real)
  const credorReal = await db('dim_credor')
    .whereRaw('UPPER(nome) = ?', [nome])
    .first()
    ?? await db('dim_credor')
      .whereRaw('UPPER(nome) LIKE ?', [`${nome.slice(0, 30)}%`])
      .first();

  if (credorReal) {
    return { fkCredor: credorReal.id, fkCredorAPagar: null, criado: false };
  }

  // 2. Busca em dim_credor_a_pagar (empenhos anteriores já classificados)
  const credorAPagar = await db('dim_credor_a_pagar')
    .whereRaw('UPPER(nome) = ?', [nome])
    .first()
    ?? await db('dim_credor_a_pagar')
      .whereRaw('UPPER(nome) LIKE ?', [`${nome.slice(0, 30)}%`])
      .first();

  if (credorAPagar) {
    // Atualiza histórico se ainda não tem
    if (historico && !credorAPagar.historico) {
      await db('dim_credor_a_pagar').where('id', credorAPagar.id).update({
        historico: historico.trim().slice(0, 500),
      });
    }
    return { fkCredor: null, fkCredorAPagar: credorAPagar.id, criado: false };
  }

  // 3. Cria em dim_credor_a_pagar
  const [{ id: newId }] = await db('dim_credor_a_pagar').insert({
    nome:         nomeRaw.trim(),
    fk_municipio: fkMunicipio,
    fk_grupo:     null,
    fk_subgrupo:  null,
    historico:    historico ? historico.trim().slice(0, 500) : null,
    criado_em:    new Date().toISOString(),
  }).returning('id');

  logger.info({ nome: nomeRaw.trim(), newId }, 'Credor criado em dim_credor_a_pagar');
  return { fkCredor: null, fkCredorAPagar: newId, criado: true };
}

export async function loadEmpenhoLiquidadoToMySQL(
  db: Knex,
  rows: RawEmpenhoLiquidado[],
  importJobId: number,
  entidadeId: number,
  periodoRef: string,
): Promise<EmpenhoLiquidadoLoadResult> {
  let rows_loaded = 0;
  let rows_skipped = 0;
  let rows_updated = 0;
  let valor_total = 0;
  let valor_a_pagar = 0;
  let credores_criados = 0;

  const entidade = await db('dim_entidade').where('id', entidadeId).first();
  if (!entidade) throw new Error(`Entidade id=${entidadeId} não encontrada`);
  const fkMunicipio = entidade.fk_municipio ?? null;

  // Reimportação limpa — apaga registros do mesmo período+entidade
  await db('fact_empenho_liquidado')
    .where('periodo_ref', periodoRef)
    .where('fk_entidade', entidadeId)
    .delete();

  const existingHashes = new Set<string>();

  // Cache: nome → { fkCredor, fkCredorAPagar }
  const credorCache: Record<string, { fkCredor: number | null; fkCredorAPagar: number | null }> = {};

  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);

    for (const row of chunk) {
      const hash = hashEmpenho(row, periodoRef);

      if (existingHashes.has(hash)) {
        if (row.dt_pagamento) {
          await db('fact_empenho_liquidado')
            .where('hash_linha', hash)
            .whereNull('dt_pagamento')
            .update({ dt_pagamento: row.dt_pagamento });
          rows_updated++;
        } else {
          rows_skipped++;
        }
        continue;
      }

      if (!(row.credor_nome in credorCache)) {
        try {
          const result = await resolveCredor(db, row.credor_nome, fkMunicipio, row.historico);
          credorCache[row.credor_nome] = { fkCredor: result.fkCredor, fkCredorAPagar: result.fkCredorAPagar };
          if (result.criado) credores_criados++;
        } catch (err: any) {
          logger.warn({ nome: row.credor_nome, err: err.message }, 'Não foi possível resolver/criar credor');
          credorCache[row.credor_nome] = { fkCredor: null, fkCredorAPagar: null };
        }
      }

      const { fkCredor, fkCredorAPagar } = credorCache[row.credor_nome];

      try {
        await db('fact_empenho_liquidado').insert({
          fk_municipio:      fkMunicipio,
          fk_entidade:       entidadeId,
          fk_import_job:     importJobId,
          dt_liquidacao:     row.dt_liquidacao,
          num_empenho:       row.num_empenho || null,
          num_reduzido:      row.num_reduzido || null,
          classificacao_orc: row.classificacao_orc || null,
          credor_nome:       row.credor_nome || null,
          fk_credor:         fkCredor,
          fk_credor_a_pagar: fkCredorAPagar,
          historico:         row.historico || null,
          tipo_empenho:      row.tipo_empenho || null,
          dt_empenho:        row.dt_empenho || null,
          num_processo:      row.num_processo || null,
          dt_pagamento:      row.dt_pagamento || null,
          valor:             row.valor,
          periodo_ref:       periodoRef,
          hash_linha:        hash,
          criado_em:         new Date().toISOString(),
        });

        existingHashes.add(hash);
        rows_loaded++;
        valor_total += row.valor;
        if (!row.dt_pagamento) valor_a_pagar += row.valor;
      } catch (err: any) {
        if (err.message?.includes('UNIQUE')) {
          rows_skipped++;
        } else {
          logger.error({ err: err.message, row }, 'EmpenhoLiquidado insert error');
          rows_skipped++;
        }
      }
    }
  }

  return {
    rows_loaded,
    rows_skipped,
    rows_updated,
    valor_total:   Math.round(valor_total * 100) / 100,
    valor_a_pagar: Math.round(valor_a_pagar * 100) / 100,
    credores_criados,
  };
}
