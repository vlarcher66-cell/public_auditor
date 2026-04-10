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

// Resolve fk_credor pelo nome — cria automaticamente se não existir
async function resolveOrCreateCredor(
  db: Knex,
  nomeRaw: string,
  fkMunicipio: number | null,
  historicoEmpenho?: string | null,
): Promise<{ id: number; criado: boolean }> {
  if (!nomeRaw) throw new Error('Nome do credor vazio');
  const nome = nomeRaw.trim().toUpperCase();

  // 1. Busca exata
  const exact = await db('dim_credor').whereRaw('UPPER(nome) = ?', [nome]).first();
  if (exact) {
    const upd: Record<string, any> = {};
    if (historicoEmpenho) upd.historico = historicoEmpenho.trim().slice(0, 500);
    // Se ainda não tem origem definida, marca como A_PAGAR — já tem pagamento, mas também aparece em empenhos
    if (!exact.origem) upd.origem = 'A_PAGAR';
    if (Object.keys(upd).length) await db('dim_credor').where('id', exact.id).update(upd);
    return { id: exact.id, criado: false };
  }

  // 2. Busca parcial (começa com os primeiros 30 chars)
  const partial = await db('dim_credor').whereRaw('UPPER(nome) LIKE ?', [`${nome.slice(0, 30)}%`]).first();
  if (partial) {
    const upd: Record<string, any> = {};
    if (historicoEmpenho) upd.historico = historicoEmpenho.trim().slice(0, 500);
    if (!partial.origem) upd.origem = 'A_PAGAR';
    if (Object.keys(upd).length) await db('dim_credor').where('id', partial.id).update(upd);
    return { id: partial.id, criado: false };
  }

  // 3. Cria o credor automaticamente (sem CNPJ/CPF — relatório não fornece)
  // Preenche historico com o historico do empenho para facilitar classificação pelo usuário
  const [{ id: newId }] = await db('dim_credor').insert({
    nome:         nomeRaw.trim(),
    fk_municipio: fkMunicipio,
    fk_grupo:     null,
    fk_subgrupo:  null,
    historico:    historicoEmpenho ? historicoEmpenho.trim().slice(0, 500) : null,
    origem:       'A_PAGAR',
  }).returning('id');

  logger.info({ nome: nomeRaw.trim(), newId }, 'Credor criado automaticamente via importação de empenhos');
  return { id: newId, criado: true };
}

export async function loadEmpenhoLiquidadoToMySQL(
  db: Knex,
  rows: RawEmpenhoLiquidado[],
  importJobId: number,
  entidadeId: number,
  periodoRef: string, // formato 'YYYY-MM' ex: '2026-01'
): Promise<EmpenhoLiquidadoLoadResult> {
  let rows_loaded = 0;
  let rows_skipped = 0;
  let rows_updated = 0;
  let valor_total = 0;
  let valor_a_pagar = 0;
  let credores_criados = 0;

  // Resolve entidade e município
  const entidade = await db('dim_entidade').where('id', entidadeId).first();
  if (!entidade) throw new Error(`Entidade id=${entidadeId} não encontrada`);
  const fkMunicipio = entidade.fk_municipio ?? null;

  // Apaga registros anteriores do mesmo período+entidade — reimportação limpa
  await db('fact_empenho_liquidado')
    .where('periodo_ref', periodoRef)
    .where('fk_entidade', entidadeId)
    .delete();

  const existingHashes = new Set<string>();

  // Cache de credores para evitar N+1 — armazena o id resolvido/criado
  const credorCache: Record<string, number> = {};

  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);

    for (const row of chunk) {
      const hash = hashEmpenho(row, periodoRef);

      // Se já existe esse hash exato, atualiza dt_pagamento se necessário
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

      // Resolve ou cria credor — garante que fk_credor nunca fica NULL
      if (!(row.credor_nome in credorCache)) {
        try {
          const result = await resolveOrCreateCredor(db, row.credor_nome, fkMunicipio, row.historico);
          credorCache[row.credor_nome] = result.id;
          if (result.criado) credores_criados++;
        } catch (err: any) {
          logger.warn({ nome: row.credor_nome, err: err.message }, 'Não foi possível resolver/criar credor');
          credorCache[row.credor_nome] = 0; // fallback — não bloqueia a importação
        }
      }
      const fkCredor = credorCache[row.credor_nome] || null;

      try {
        await db('fact_empenho_liquidado').insert({
          fk_municipio:     fkMunicipio,
          fk_entidade:      entidadeId,
          fk_import_job:    importJobId,
          dt_liquidacao:    row.dt_liquidacao,
          num_empenho:      row.num_empenho || null,
          num_reduzido:     row.num_reduzido || null,
          classificacao_orc: row.classificacao_orc || null,
          credor_nome:      row.credor_nome || null,
          fk_credor:        fkCredor,
          historico:        row.historico || null,
          tipo_empenho:     row.tipo_empenho || null,
          dt_empenho:       row.dt_empenho || null,
          num_processo:     row.num_processo || null,
          dt_pagamento:     row.dt_pagamento || null,
          valor:            row.valor,
          periodo_ref:      periodoRef,
          hash_linha:       hash,
          criado_em:        new Date().toISOString(),
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
    valor_total:      Math.round(valor_total * 100) / 100,
    valor_a_pagar:    Math.round(valor_a_pagar * 100) / 100,
    credores_criados,
  };
}
