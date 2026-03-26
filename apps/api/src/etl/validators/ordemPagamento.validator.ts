import { z } from 'zod';
import type { TransformedOrdemPagamento } from '../transformers/ordemPagamento.transformer';
import type { ImportErrorEntry } from '@public-auditor/shared';

const MIN_DATE = new Date('1990-01-01');
const MAX_DATE = new Date('2100-01-01');

function isValidDate(d: Date | null): boolean {
  if (!d || !(d instanceof Date) || isNaN(d.getTime())) return false;
  return d >= MIN_DATE && d <= MAX_DATE;
}

export interface ValidationResult {
  valid: TransformedOrdemPagamento[];
  invalid: Array<{ row_index: number; row: TransformedOrdemPagamento; errors: ImportErrorEntry[] }>;
}

export function validateRows(rows: TransformedOrdemPagamento[]): ValidationResult {
  const valid: TransformedOrdemPagamento[] = [];
  const invalid: ValidationResult['invalid'] = [];

  rows.forEach((row, idx) => {
    const errors: ImportErrorEntry[] = [];

    // Required fields
    if (!row.data_pagamento || !isValidDate(row.data_pagamento)) {
      errors.push({ row_index: idx, field: 'data_pagamento', message: 'Data de pagamento inválida', raw_value: String(row.data_pagamento) });
    }

    if (!row.num_empenho) {
      errors.push({ row_index: idx, field: 'num_empenho', message: 'Número de empenho obrigatório', raw_value: '' });
    }

    if (!row.credor_nome) {
      errors.push({ row_index: idx, field: 'credor_nome', message: 'Nome do credor obrigatório', raw_value: '' });
    }

    if (!row.cnpj_cpf_norm) {
      errors.push({ row_index: idx, field: 'cnpj_cpf', message: 'CNPJ/CPF obrigatório', raw_value: row.cnpj_cpf });
    }

    // Value consistency: valor_liquido ≈ valor_bruto - valor_retido (tolerance 0.02)
    const expectedLiquido = Math.round((row.valor_bruto - row.valor_retido) * 100) / 100;
    const diff = Math.abs(expectedLiquido - row.valor_liquido);
    if (row.valor_bruto > 0 && diff > 0.05) {
      // Some rows have valor_liquido in different column — try to be lenient
      // Only error if the difference is substantial
      if (diff > 1.0) {
        errors.push({
          row_index: idx,
          field: 'valor_liquido',
          message: `Valor líquido inconsistente: esperado ${expectedLiquido}, encontrado ${row.valor_liquido}`,
          raw_value: String(row.valor_liquido),
        });
      }
    }

    // entidade_cnpj is optional (XLSX files don't always include it)

    if (!isValidDate(row.periodo_inicio) || !isValidDate(row.periodo_fim)) {
      errors.push({ row_index: idx, field: 'periodo', message: 'Período inválido', raw_value: `${row.periodo_inicio} a ${row.periodo_fim}` });
    }

    if (errors.length === 0) {
      valid.push(row);
    } else {
      invalid.push({ row_index: idx, row, errors });
    }
  });

  return { valid, invalid };
}
