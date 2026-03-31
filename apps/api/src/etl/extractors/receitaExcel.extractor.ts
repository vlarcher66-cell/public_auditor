import * as XLSX from 'xlsx';
import type { RawReceita } from './receita.extractor';

/**
 * Extrai registros de receita do Excel exportado pelo sistema FATOR.
 *
 * Layout esperado:
 *   Linha 0: ["", ..., "Período: 01/01/2026 a 31/01/2026", ...]
 *   Linha 1: ["Data","Conhecimento","Empenho","Código","Fonte","Descrição","Fornecedor","Documento","Valor",""]
 *   Linha 2: vazia
 *   Linhas 3..N: dados
 *   Última(s): "Total de Registros: X" → ignorar
 */
export function extractReceitaFromExcel(filePath: string): RawReceita[] {
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const allRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });

  // ── Extrai período do cabeçalho (linha 0, coluna 7) ──────────────────────────
  const headerRow0 = String(allRows[0]?.[7] ?? '');
  const periodMatch = headerRow0.match(/([\d]{2}\/[\d]{2}\/[\d]{4})\s+a\s+([\d]{2}\/[\d]{2}\/[\d]{4})/);
  const periodo_inicio = periodMatch?.[1] || '';
  const periodo_fim    = periodMatch?.[2] || '';

  // ── Encontra linha de cabeçalho das colunas ───────────────────────────────────
  // Linha 1 deve ser: Data, Conhecimento, Empenho, Código, Fonte, Descrição, Fornecedor, Documento, Valor
  // Índices fixos com base no layout do FATOR:
  const COL_DATA       = 0;
  const COL_CONHEC     = 1;
  const COL_EMPENHO    = 2;
  const COL_CODIGO     = 3;
  const COL_FONTE      = 4;
  const COL_DESCRICAO  = 5;
  const COL_FORNECEDOR = 6;
  const COL_DOCUMENTO  = 7;
  const COL_VALOR      = 8;

  const rows: RawReceita[] = [];

  // Dados começam na linha 3 (índice 3)
  for (let i = 3; i < allRows.length; i++) {
    const row = allRows[i];

    // Ignora linhas de totalização e linhas vazias
    const col0 = String(row[COL_DATA] ?? '').trim();
    if (!col0 || /^Total/i.test(col0)) continue;

    // Data: pode vir como serial numérico do Excel ou string dd/mm/yyyy
    const data_receita = parseExcelDate(row[COL_DATA]);
    if (!data_receita) continue;

    // Valor: número direto (Excel já resolve)
    const valorRaw = row[COL_VALOR];
    const valorNum = typeof valorRaw === 'number' ? valorRaw : parseFloat(String(valorRaw).replace(',', '.'));
    if (!valorNum || isNaN(valorNum) || valorNum === 0) continue;

    // Fonte: "15001002" → "1500" (primeiros 4 dígitos após remover zeros)
    const fonteRaw = String(row[COL_FONTE] ?? '').trim();
    const fonte = extrairFonteCodigo(fonteRaw);

    rows.push({
      data_receita,
      conhecimento: String(row[COL_CONHEC] ?? '').trim(),
      num_empenho:  String(row[COL_EMPENHO] ?? '').trim(),
      codigo_rubrica: String(row[COL_CODIGO] ?? '').trim(),
      descricao:    String(row[COL_DESCRICAO] ?? '').trim(),
      fornecedor_nome: String(row[COL_FORNECEDOR] ?? '').trim(),
      fornecedor_doc:  String(row[COL_DOCUMENTO] ?? '').trim(),
      valor:        String(valorNum),   // loader já lida com string numérica
      entidade_nome: '',
      entidade_cnpj: '',
      periodo_inicio,
      periodo_fim,
      fonte_recurso_raw: fonte,
    });
  }

  return rows;
}

/**
 * Converte serial Excel ou string dd/mm/yyyy → "yyyy-mm-dd"
 */
function parseExcelDate(value: any): string | null {
  if (!value && value !== 0) return null;

  // String no formato dd/mm/yyyy
  if (typeof value === 'string') {
    const m = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    return null;
  }

  // Serial numérico do Excel (dias desde 1900-01-01, com bug de 1900 ser bissexto)
  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value);
    if (!date) return null;
    const mm = String(date.m).padStart(2, '0');
    const dd = String(date.d).padStart(2, '0');
    return `${date.y}-${mm}-${dd}`;
  }

  return null;
}

/**
 * Extrai código de fonte de recurso do campo "Fonte" do FATOR.
 * "15001002" → "1500"
 * "16000000" → "1600"
 * "16040000" → "1604"
 * "16050000" → "1605"
 * "16310000" → "1631"
 */
function extrairFonteCodigo(raw: string): string {
  if (!raw) return '';
  // O código tem 8 dígitos: primeiros 4 são a fonte
  const digits = raw.replace(/\D/g, '');
  if (digits.length >= 4) return digits.slice(0, 4);
  return raw;
}
