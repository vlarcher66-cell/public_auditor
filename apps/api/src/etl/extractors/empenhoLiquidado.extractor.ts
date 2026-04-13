import * as XLSX from 'xlsx';

export interface RawEmpenhoLiquidado {
  dt_liquidacao: string;       // yyyy-mm-dd
  num_empenho: string;
  num_reduzido: string;
  classificacao_orc: string;
  credor_nome: string;
  historico: string;
  tipo_empenho: string;
  dt_empenho: string | null;   // yyyy-mm-dd
  num_processo: string;
  dt_pagamento: string | null; // yyyy-mm-dd ou null = a pagar
  valor: number;
}

// Colunas do relatório "Listagem de Empenhos Liquidados" (linha de cabeçalho na linha 4, dados a partir da linha 5)
const COL_DT_LIQUIDACAO  = 0;  // A: Dt Liquidação
const COL_EMPENHO        = 1;  // B: Empenho
const COL_REDUZIDO       = 2;  // C: Reduzido
const COL_CLASS_ORC      = 3;  // D: Classificação Orçamentária
const COL_CREDOR         = 4;  // E: Credor
const COL_HISTORICO      = 5;  // F: Histórico
const COL_TIPO_EMPENHO   = 6;  // G: Tipo Empenho
const COL_DT_EMPENHO     = 7;  // H: Dt Empenho
const COL_NUM_PROCESSO   = 8;  // I: Nº Processo
const COL_DT_PAGAMENTO   = 9;  // J: Dt Pagamento
const COL_VALOR          = 10; // K: Valor

export function extractEmpenhoLiquidadoFromExcel(filePath: string): RawEmpenhoLiquidado[] {
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const allRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });

  const rows: RawEmpenhoLiquidado[] = [];

  // Dados começam na linha 6 (índice 5)
  for (let i = 5; i < allRows.length; i++) {
    const row = allRows[i];

    // Pula linhas de rodapé/assinatura — mas não para, pois podem ter dados depois
    const col0 = String(row[COL_DT_LIQUIDACAO] ?? '').trim();
    if (!col0 || /^Total\s+de/i.test(col0) || /^Total:/i.test(col0)) continue;
    if (/^(João|CPF|CRF|Prefeito|Secretar|Contador)/i.test(col0)) continue;

    const dt_liquidacao = parseExcelDate(row[COL_DT_LIQUIDACAO]);
    if (!dt_liquidacao) {
      console.log(`[SKIP] linha ${i + 1}: dt_liquidacao inválida — raw="${row[COL_DT_LIQUIDACAO]}"`);
      continue;
    }

    const valorRaw = row[COL_VALOR];
    const valor = typeof valorRaw === 'number'
      ? valorRaw
      : parseFloat(String(valorRaw).replace(/\./g, '').replace(',', '.')) || 0;
    if (valor === 0 || isNaN(valor)) {
      console.log(`[SKIP] linha ${i + 1}: valor zero/inválido — raw="${valorRaw}" credor="${row[COL_CREDOR]}"`);
      continue;
    }

    rows.push({
      dt_liquidacao,
      num_empenho:     String(row[COL_EMPENHO]      ?? '').trim(),
      num_reduzido:    String(row[COL_REDUZIDO]      ?? '').trim(),
      classificacao_orc: String(row[COL_CLASS_ORC]  ?? '').trim(),
      credor_nome:     String(row[COL_CREDOR]        ?? '').trim(),
      historico:       String(row[COL_HISTORICO]     ?? '').trim(),
      tipo_empenho:    String(row[COL_TIPO_EMPENHO]  ?? '').trim(),
      dt_empenho:      parseExcelDate(row[COL_DT_EMPENHO]),
      num_processo:    String(row[COL_NUM_PROCESSO]  ?? '').trim(),
      dt_pagamento:    parseExcelDate(row[COL_DT_PAGAMENTO]),
      valor,
    });
  }

  return rows;
}

function parseExcelDate(value: any): string | null {
  if (!value && value !== 0) return null;

  if (typeof value === 'string') {
    const v = value.trim();
    if (!v) return null;
    // dd/mm/yyyy
    const m1 = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m1) return `${m1[3]}-${m1[2]}-${m1[1]}`;
    // dd.mm.yyyy
    const m2 = v.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (m2) return `${m2[3]}-${m2[2]}-${m2[1]}`;
    // yyyy-mm-dd
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    return null;
  }

  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value);
    if (!date) return null;
    const mm = String(date.m).padStart(2, '0');
    const dd = String(date.d).padStart(2, '0');
    return `${date.y}-${mm}-${dd}`;
  }

  return null;
}
