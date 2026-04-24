/**
 * Extractor para "Listagem Transferência Bancária / Transferência Financeira"
 * exportado em XLSX pelo sistema FATOR.
 *
 * Detecta colunas dinamicamente pelo cabeçalho (linha 6) para suportar
 * arquivos com diferente número de colunas mescladas entre meses.
 */

import * as XLSX from 'xlsx';
import type { RawTransfBancaria } from './transferenciaBancaria.extractor';

export function extractTransfBancariaFromExcel(filePath: string): RawTransfBancaria[] {
  const wb = XLSX.readFile(filePath, { raw: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const allRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });

  // ── Período ──────────────────────────────────────────────────────────────
  let periodo_inicio = '';
  let periodo_fim    = '';
  for (let i = 0; i < Math.min(8, allRows.length); i++) {
    for (const cell of allRows[i]) {
      const s = String(cell ?? '');
      const m = s.match(/(\d{2}\/\d{2}\/\d{4})\s+a\s+(\d{2}\/\d{2}\/\d{4})/);
      if (m) { periodo_inicio = m[1]; periodo_fim = m[2]; break; }
    }
    if (periodo_inicio) break;
  }

  // ── Detecta linha de cabeçalho e índices das colunas ─────────────────────
  let headerRow = -1;
  for (let i = 0; i < Math.min(10, allRows.length); i++) {
    const joined = allRows[i].map((c: any) => String(c ?? '').trim()).join('|');
    if (/Data/i.test(joined) && /Valor/i.test(joined)) {
      headerRow = i;
      break;
    }
  }

  // Fallback: usa índices fixos do layout de Janeiro se não achar cabeçalho
  let C_DATA       = 2;
  let C_ORGAO_ORIG = 5;
  let C_CONTA_ORIG = 8;
  let C_FONTE_ORIG = 19;
  let C_ORGAO_DEST = 23;
  let C_CONTA_DEST = 25;
  let C_FONTE_DEST = 30;
  let C_NUM_DOC    = 32;
  let C_TIPO_DOC   = 35;
  let C_VALOR      = 36;
  let C_HIST_TEXT  = 5;
  let dataStart    = 7;

  if (headerRow >= 0) {
    const hdr = allRows[headerRow].map((c: any) => String(c ?? '').trim());
    dataStart = headerRow + 1;

    // Encontra cada coluna pelo texto do cabeçalho
    const find = (...terms: string[]) => {
      for (let i = 0; i < hdr.length; i++) {
        if (terms.some(t => hdr[i].toLowerCase().includes(t.toLowerCase()))) return i;
      }
      return -1;
    };

    const iValor    = find('Valor');
    const iFontOrig = find('Fonte Origem', 'Fonte\nOrigem');
    const iFontDest = find('Fonte Destino', 'Fonte\nDestino');
    const iNumDoc   = find('Nº Documento', 'No Documento', 'Documento');
    const iTipo     = find('Tipo');

    if (iValor    >= 0) C_VALOR      = iValor;
    if (iFontOrig >= 0) C_FONTE_ORIG = iFontOrig;
    if (iFontDest >= 0) C_FONTE_DEST = iFontDest;
    if (iNumDoc   >= 0) C_NUM_DOC    = iNumDoc;
    if (iTipo     >= 0) C_TIPO_DOC   = iTipo;

    // Órgão origem = primeira coluna com "Órgão" antes de Fonte Origem
    // Órgão destino = segunda coluna com "Órgão" depois de Fonte Origem
    const orgaoCols: number[] = [];
    hdr.forEach((h, i) => { if (/^Órgão$/i.test(h) || /^Orgao$/i.test(h)) orgaoCols.push(i); });
    if (orgaoCols.length >= 1) C_ORGAO_ORIG = orgaoCols[0];
    if (orgaoCols.length >= 2) C_ORGAO_DEST = orgaoCols[1];

    // Conta origem = primeira "Conta", Conta destino = segunda "Conta"
    const contaCols: number[] = [];
    hdr.forEach((h, i) => { if (/Conta/i.test(h)) contaCols.push(i); });
    if (contaCols.length >= 1) C_CONTA_ORIG = contaCols[0];
    if (contaCols.length >= 2) C_CONTA_DEST = contaCols[1];

    // Histórico: texto na coluna do Órgão origem
    C_HIST_TEXT = C_ORGAO_ORIG > 0 ? C_ORGAO_ORIG : 5;
    // C_TIPO_LANC não é usado mais — tipo_lancamento é extraído do texto da linha de histórico

    // C_DATA: cabeçalho tem "Data" na col 0 mas dado real pode estar em col 2
    // por causa de mesclagem — detecta na primeira linha de dados
    const firstDataRow = allRows[dataStart];
    if (firstDataRow) {
      const dataCol = firstDataRow.findIndex((v: any) => typeof v === 'number' && v >= 40000);
      if (dataCol >= 0) C_DATA = dataCol;
    }
  }

  const results: RawTransfBancaria[] = [];

  for (let i = dataStart; i < allRows.length; i++) {
    const row = allRows[i];

    // ── Linha de DADOS: data numérica Excel ou string DD/MM/YYYY na col C_DATA ──
    const dataVal = row[C_DATA];
    let data_transf: string | null = null;

    if (typeof dataVal === 'number' && dataVal >= 40000) {
      data_transf = parseExcelDate(dataVal);
    } else if (typeof dataVal === 'string') {
      const m = dataVal.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (m) data_transf = `${m[3]}-${m[2]}-${m[1]}`;
    }

    if (!data_transf) continue;

    const valor = parseValor(row[C_VALOR]);
    if (valor === 0) continue;

    const contaOrigRaw = String(row[C_CONTA_ORIG] ?? '').trim();
    const contaDestRaw = String(row[C_CONTA_DEST] ?? '').trim();
    const { codigo: conta_origem_codigo, nome: conta_origem_nome } = parseConta(contaOrigRaw);
    const { codigo: conta_destino_codigo, nome: conta_destino_nome } = parseConta(contaDestRaw);

    // ── Linha de histórico (próximas até 3 linhas) ────────────────────────
    let historico       = '';
    let tipo_lancamento = '';

    for (let j = i + 1; j <= i + 3 && j < allRows.length; j++) {
      const nrow = allRows[j];
      const label = String(nrow[0] ?? '').trim();
      if (/^Hist[oó]rico[:\s]*/i.test(label)) {
        // Junta todas as células da linha num texto único para extrair histórico e tipo
        const fullText = nrow
          .map((c: any) => String(c ?? '').trim())
          .filter(Boolean)
          .join(' ')
          .replace(/^Hist[oó]rico[:\s]*/i, '')
          .trim();

        // Separa o tipo (ex: "TRANSFERÊNCIA FINANCEIRA RECEBIDA") do histórico
        const typeMatch = fullText.match(/^(.+?)\s{2,}(TRANSFER[EÊ]NCIA\s+FINANCEIRA\s+\w+)\s*$/i);
        if (typeMatch) {
          historico       = typeMatch[1].trim();
          tipo_lancamento = typeMatch[2].trim().toUpperCase();
        } else {
          const typeOnly = fullText.match(/(TRANSFER[EÊ]NCIA\s+FINANCEIRA\s+\w+)/i);
          if (typeOnly) {
            tipo_lancamento = typeOnly[1].trim().toUpperCase();
            historico       = fullText.replace(typeOnly[1], '').trim();
          } else {
            historico = fullText;
          }
        }

        i = j;
        break;
      }
    }

    results.push({
      data_transf,
      orgao_origem:         parseOrgao(row[C_ORGAO_ORIG]),
      conta_origem_codigo,
      conta_origem_nome,
      fonte_origem:         normalizeFonte(String(row[C_FONTE_ORIG] ?? '')),
      orgao_destino:        parseOrgao(row[C_ORGAO_DEST]),
      conta_destino_codigo,
      conta_destino_nome,
      fonte_destino:        normalizeFonte(String(row[C_FONTE_DEST] ?? '')),
      num_documento:        String(row[C_NUM_DOC] ?? '').trim(),
      tipo_documento:       String(row[C_TIPO_DOC] ?? '').trim().replace(/\s+/g, '').toUpperCase(),
      valor:                String(valor),
      historico,
      tipo_lancamento,
      periodo_inicio,
      periodo_fim,
    });
  }

  return results;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseExcelDate(value: number): string | null {
  const date = XLSX.SSF.parse_date_code(value);
  if (!date) return null;
  return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
}

function parseValor(raw: any): number {
  if (typeof raw === 'number') return raw;
  const s = String(raw ?? '').trim().replace(/\./g, '').replace(',', '.');
  return parseFloat(s) || 0;
}

function normalizeFonte(raw: string): string {
  const digits = raw.trim().replace(/\D/g, '');
  return digits.slice(0, 4);
}

function parseOrgao(raw: any): number | null {
  const n = parseInt(String(raw ?? ''));
  return isNaN(n) ? null : n;
}

function parseConta(raw: string): { codigo: string; nome: string } {
  if (!raw) return { codigo: '', nome: '' };
  const s = raw.replace(/\s*-\s*(\d)/g, '-$1').replace(/\s+/g, ' ').trim();
  const sep = s.search(/\s+-\s+[A-Za-zÀ-ÿ0-9]/);
  if (sep !== -1) {
    return {
      codigo: s.slice(0, sep).trim(),
      nome:   s.slice(sep).replace(/^\s*-\s*/, '').trim(),
    };
  }
  return { codigo: s, nome: '' };
}
