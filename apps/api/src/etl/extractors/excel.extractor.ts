import * as XLSX from 'xlsx';
import type { RawOrdemPagamento } from '@public-auditor/shared';

export function extractFromExcel(filePath: string): RawOrdemPagamento[] {
  const workbook = XLSX.readFile(filePath, { cellDates: false });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  const rawData: any[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
    raw: true,
  }) as any[][];

  if (rawData.length < 2) return [];

  // Find header row (contains "Empenho" as standalone cell)
  let headerRowIdx = -1;
  for (let i = 0; i < Math.min(rawData.length, 20); i++) {
    if (rawData[i].some((c) => /^empenho$/i.test(c?.toString().trim() || ''))) {
      headerRowIdx = i;
      break;
    }
  }
  if (headerRowIdx < 0) return [];

  // Parse period from row 0 (last non-null cell)
  const row0 = rawData[0] || [];
  const periodCell = [...row0].reverse().find((c) => c != null)?.toString() || '';
  const periodMatch = periodCell.match(/([\d]{2}\/[\d]{2}\/[\d]{4})\s+a\s+([\d]{2}\/[\d]{2}\/[\d]{4})/);
  const periodo_inicio = periodMatch?.[1] || '';
  const periodo_fim = periodMatch?.[2] || '';

  // Map columns from header row
  const headers = rawData[headerRowIdx].map((h) => h?.toString().trim().toLowerCase() || '');
  const col = {
    data_pagamento:  headers.findIndex((h) => /dt\s*pag/i.test(h)),
    num_empenho:     headers.findIndex((h) => /^empenho$/i.test(h)),
    reduzido:        headers.findIndex((h) => /^reduzido$/i.test(h)),
    classificacao:   headers.findIndex((h) => /classifica/i.test(h)),
    credor:          headers.findIndex((h) => /^credor$/i.test(h)),
    historico:       headers.findIndex((h) => /^hist[oó]rico$/i.test(h)),
    cnpj_cpf:        headers.findIndex((h) => /cnpj.*cpf|cnpj_cpf/i.test(h)),
    tipo_empenho:    headers.findIndex((h) => /tipo.*empenho/i.test(h)),
    data_empenho:    headers.findIndex((h) => /dt\s*emp/i.test(h) && !/pag/i.test(h)),
    data_liquidacao: headers.findIndex((h) => /liquid/i.test(h)),
    num_processo:    headers.findIndex((h) => /proc/i.test(h)),
    valor_bruto:     headers.findIndex((h) => /valor\s*bruto/i.test(h)),
    valor_retido:    headers.findIndex((h) => /retido/i.test(h)),
    valor_liquido:   headers.findIndex((h) => /valor\s*l[íi]quido/i.test(h)),
  };

  const rows: RawOrdemPagamento[] = [];

  for (let i = headerRowIdx + 1; i < rawData.length; i++) {
    const row = rawData[i];
    if (!row || row.every((c) => c == null || c === '')) continue;

    const dataPag = excelDateToString(row[col.data_pagamento]);
    if (!/\d{2}\/\d{2}\/\d{4}/.test(dataPag)) continue;

    const reduzidoRaw = formatReduzido(str(row[col.reduzido]));
    const classificacao = str(row[col.classificacao]);
    const valorBruto = str(row[col.valor_bruto]);
    const valorRetido = str(row[col.valor_retido]);
    const valorLiquido = str(row[col.valor_liquido]);

    rows.push({
      data_pagamento: dataPag,
      num_empenho: str(row[col.num_empenho]),
      reduzido: reduzidoRaw,
      classificacao_orcamentaria: classificacao,
      credor: str(row[col.credor]),
      cnpj_cpf: str(row[col.cnpj_cpf]),
      tipo_empenho: str(row[col.tipo_empenho]),
      data_empenho: excelDateToString(row[col.data_empenho]),
      data_liquidacao: excelDateToString(row[col.data_liquidacao]),
      num_processo: str(row[col.num_processo]),
      valor_bruto: valorBruto || '0',
      valor_retido: valorRetido || '0',
      valor_liquido: valorLiquido || '0',
      valor_pessoal: '0',
      historico: col.historico >= 0 ? str(row[col.historico]) : '',
      entidade_nome: '',
      entidade_cnpj: '',
      periodo_inicio,
      periodo_fim,
    });
  }

  return rows;
}

// Convert Excel serial date or formatted string to "dd/mm/yyyy"
function excelDateToString(v: any): string {
  if (v == null) return '';
  const s = v.toString().trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;
  const num = parseFloat(s);
  if (!isNaN(num) && num > 40000 && num < 60000) {
    const d = new Date((num - 25569) * 86400000);
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${d.getUTCFullYear()}`;
  }
  return s;
}

// Convert "20523915001002" → "2052.39.15001002" (NNNN.SS.FFFFFFFF)
function formatReduzido(raw: string): string {
  const s = raw.replace(/\D/g, '');
  if (s.length >= 14) {
    return `${s.slice(0, 4)}.${s.slice(4, 6)}.${s.slice(6, 14)}`;
  }
  // Already dotted or short
  return raw;
}

function str(v: any): string {
  if (v == null) return '';
  return v.toString().trim();
}
