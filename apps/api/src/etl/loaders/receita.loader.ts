import { Knex } from 'knex';
import { createHash } from 'crypto';
import type { RawReceita } from '../extractors/receita.extractor';
import { logger } from '../../config/logger';

const CHUNK_SIZE = 200;

export interface ReceitaLoadResult {
  rows_loaded: number;
  rows_skipped: number;
  valor_total: number;
}

// Normaliza valor: "1.249.065,00" (BR) ou "51.43" (número direto) → number
function parseBrValue(v: string): number {
  if (!v) return 0;
  // Se não tem vírgula, já é ponto decimal (número do Excel)
  if (!v.includes(',')) return parseFloat(v) || 0;
  // Formato BR: remove pontos de milhar, troca vírgula por ponto
  return parseFloat(v.replace(/\./g, '').replace(',', '.')) || 0;
}

// Normaliza data: dd/mm/yyyy ou yyyy-mm-dd → yyyy-mm-dd
function parseBrDate(d: string): string | null {
  if (!d) return null;
  // já no formato yyyy-mm-dd (vindo do extrator Excel)
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  // formato BR dd/mm/yyyy
  const m = d.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

// Extrai fonte de recurso do código da rubrica (últimos 3 dígitos do segmento de fonte)
// Ex: "2.1.8.8.1.01.04.00.00.003" → "1500" (via descrição)
// ou da descrição: "IRRF - Fonte 1500" → "1500"
function extrairFonte(descricao: string, codigoRubrica: string): string {
  // Tenta extrair da descrição (ex: "Fonte 1500", "Fonte 1600")
  const descM = descricao.match(/Fonte\s+(\d{4})/i);
  if (descM) return descM[1];

  // Tenta extrair do código: segmento .003 → 1500, .023 → 1600, .027 → 1604, .066/.070 → 1605, .030 → 1631
  const segMap: Record<string, string> = {
    '003': '1500',
    '023': '1600',
    '027': '1604',
    '066': '1605',
    '070': '1605',
    '030': '1631',
    '081': '1604',
  };
  const segM = codigoRubrica.match(/\.(\d{3})$/);
  if (segM && segMap[segM[1]]) return segMap[segM[1]];

  return '';
}

// Determina tipo: ORC (orçamentária) se código começa com 1. ou 2., EXTRA se começa com 2.1.8 ou similar
function determinarTipo(codigoRubrica: string, descricao: string): string {
  // Códigos que começam com 1.x ou 2.x (receitas) = orçamentária
  // Códigos que começam com 2.1.8 = extra orçamentária (retenções, contribuições)
  if (/^2\.1\.8/.test(codigoRubrica)) return 'EXTRA';
  if (/^1\./.test(codigoRubrica) || /^2\.[^1]/.test(codigoRubrica)) return 'ORC';
  // Fallback pela descrição
  if (/IRRF|ISS|ITAPREV|RGPS|SINDICAL|EMPRÉSTIMO|PENSÃO|DEPÓSITO/i.test(descricao)) return 'EXTRA';
  return 'ORC';
}

function hashReceita(row: RawReceita): string {
  const str = [
    row.data_receita,
    row.conhecimento,
    row.num_empenho,
    row.codigo_rubrica,
    row.fornecedor_doc,
    row.valor,
  ].join('|');
  return createHash('sha256').update(str).digest('hex');
}

function parsePeriodo(periodoRef: string): { ano: number; mes: number } {
  const meses: Record<string, number> = {
    janeiro: 1, fevereiro: 2, março: 3, marco: 3, abril: 4,
    maio: 5, junho: 6, julho: 7, agosto: 8, setembro: 9,
    outubro: 10, novembro: 11, dezembro: 12,
  };
  const m = periodoRef.match(/^(\w+)\/(\d{4})$/i);
  if (!m) return { ano: new Date().getFullYear(), mes: new Date().getMonth() + 1 };
  return {
    mes: meses[m[1].toLowerCase()] ?? 1,
    ano: parseInt(m[2]),
  };
}

export async function loadReceitaToMySQL(
  db: Knex,
  rows: RawReceita[],
  importJobId: number,
  entidadeId: number,
  periodoReferencia: string,
): Promise<ReceitaLoadResult> {
  let rows_loaded = 0;
  let rows_skipped = 0;
  let valor_total = 0;

  // Resolve entidade e município
  const entidade = await db('dim_entidade').where('id', entidadeId).first();
  if (!entidade) throw new Error(`Entidade id=${entidadeId} não encontrada`);
  const fkMunicipio = entidade.fk_municipio ?? null;

  const { ano, mes } = parsePeriodo(periodoReferencia);

  // Hashes existentes para dedup
  const existingHashes = new Set<string>(
    (await db('fact_receita').select('hash_linha')).map((r: any) => r.hash_linha),
  );

  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);

    for (const row of chunk) {
      const hash = hashReceita(row);

      if (existingHashes.has(hash)) {
        rows_skipped++;
        continue;
      }

      const valor = parseBrValue(row.valor);
      const dataReceita = parseBrDate(row.data_receita);

      if (!dataReceita || valor === 0) {
        rows_skipped++;
        continue;
      }

      // Usa fonte já extraída pelo Excel extractor, ou detecta pelo código/descrição
      const fonte = row.fonte_recurso_raw || extrairFonte(row.descricao, row.codigo_rubrica);
      const tipo = determinarTipo(row.codigo_rubrica, row.descricao);

      try {
        await db('fact_receita').insert({
          data_receita: dataReceita,
          conhecimento: row.conhecimento || null,
          num_empenho: row.num_empenho || null,
          codigo_rubrica: row.codigo_rubrica || null,
          descricao: row.descricao || null,
          documento: row.fornecedor_doc || null,
          valor,
          tipo_receita: tipo,
          fonte_recurso: fonte || null,
          periodo_referencia: periodoReferencia,
          ano,
          mes,
          fornecedor_nome: row.fornecedor_nome || null,
          fornecedor_doc: row.fornecedor_doc || null,
          fk_entidade: entidadeId,
          fk_municipio: fkMunicipio,
          fk_import_job: importJobId,
          hash_linha: hash,
          criado_em: new Date().toISOString(),
        });

        existingHashes.add(hash);
        rows_loaded++;
        valor_total += valor;
      } catch (err: any) {
        if (err.message?.includes('UNIQUE')) {
          rows_skipped++;
        } else {
          logger.error({ err: err.message, row }, 'Receita insert error');
          rows_skipped++;
        }
      }
    }
  }

  return { rows_loaded, rows_skipped, valor_total: Math.round(valor_total * 100) / 100 };
}
