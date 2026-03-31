import * as crypto from 'crypto';
import type { Knex } from 'knex';
import type { RawTransfBancaria } from '../extractors/transferenciaBancaria.extractor';

const CHUNK_SIZE = 200;

/** "Janeiro/2026" → { ano: 2026, mes: 1 } */
function parsePeriodo(periodo: string): { ano: number; mes: number } {
  const MESES: Record<string, number> = {
    janeiro: 1, fevereiro: 2, março: 3, marco: 3, abril: 4,
    maio: 5, junho: 6, julho: 7, agosto: 8,
    setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
  };
  const [mesStr, anoStr] = periodo.split('/');
  const mes = MESES[(mesStr ?? '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')] ?? 1;
  const ano = parseInt(anoStr ?? '0') || new Date().getFullYear();
  return { ano, mes };
}

/** "06/01/2026" → "2026-01-06" */
function parseBrDate(raw: string): string {
  const [d, m, y] = raw.split('/');
  if (!d || !m || !y) return raw;
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

/** "14.267,88" ou "14267.88" ou 14267.88 → 14267.88 */
function parseBrValue(raw: string | number): number {
  if (typeof raw === 'number') return raw;
  const s = String(raw).trim();
  // Formato BR: tem vírgula como decimal (ex: "14.267,88")
  if (s.includes(',')) return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
  // Formato americano: ponto como decimal (ex: "14267.88") — não remover o ponto
  return parseFloat(s) || 0;
}

function buildHash(row: RawTransfBancaria, entidadeId: number): string {
  const key = [
    row.data_transf,
    row.conta_origem_codigo,
    row.conta_destino_codigo,
    row.num_documento,
    row.tipo_documento,
    row.valor,
    String(entidadeId),
  ].join('|');
  return crypto.createHash('sha256').update(key).digest('hex');
}

export async function loadTransfBancariaToMySQL(
  db: Knex,
  rows: RawTransfBancaria[],
  importJobId: number,
  entidadeId: number,
  periodoReferencia: string,
): Promise<{ rows_loaded: number; rows_skipped: number; valor_total: number }> {

  // Resolve municipio da entidade
  const entidade = await db('dim_entidade').where('id', entidadeId).first();
  if (!entidade) throw new Error(`Entidade ${entidadeId} não encontrada`);
  const fkMunicipio: number | null = entidade.fk_municipio ?? null;

  const { ano, mes } = parsePeriodo(periodoReferencia);

  let rows_loaded  = 0;
  let rows_skipped = 0;
  let valor_total  = 0;

  // Pré-calcula hashes já inseridos para evitar duplicatas nesta carga
  const hashes = rows.map(r => buildHash(r, entidadeId));
  const existing = await db('fact_transf_bancaria')
    .whereIn('hash_linha', hashes)
    .pluck('hash_linha') as string[];
  const existingSet = new Set(existing);

  // Monta registros a inserir
  const toInsert = rows
    .map((r) => {
      const hash = buildHash(r, entidadeId);
      if (existingSet.has(hash)) return null;

      return {
        data_transf:          parseBrDate(r.data_transf),
        orgao_origem:         r.orgao_origem,
        conta_origem_codigo:  r.conta_origem_codigo || null,
        conta_origem_nome:    r.conta_origem_nome   || null,
        fonte_origem:         r.fonte_origem         || null,
        orgao_destino:        r.orgao_destino,
        conta_destino_codigo: r.conta_destino_codigo || null,
        conta_destino_nome:   r.conta_destino_nome   || null,
        fonte_destino:        r.fonte_destino         || null,
        num_documento:        r.num_documento         || null,
        tipo_documento:       r.tipo_documento        || null,
        valor:                parseBrValue(r.valor),
        historico:            r.historico             || null,
        tipo_lancamento:      r.tipo_lancamento       || null,
        periodo_referencia:   periodoReferencia,
        ano,
        mes,
        fk_entidade:          entidadeId,
        fk_municipio:         fkMunicipio,
        fk_import_job:        importJobId,
        hash_linha:           hash,
        criado_em:            new Date().toISOString(),
      };
    })
    .filter(Boolean) as Record<string, any>[];

  rows_skipped = rows.length - toInsert.length;

  // Insere em chunks
  for (let i = 0; i < toInsert.length; i += CHUNK_SIZE) {
    const chunk = toInsert.slice(i, i + CHUNK_SIZE);
    await db('fact_transf_bancaria').insert(chunk);
    rows_loaded += chunk.length;
  }

  valor_total = toInsert.reduce((sum, r) => sum + (r?.valor ?? 0), 0);

  return { rows_loaded, rows_skipped, valor_total };
}
