/**
 * Extractor para "Listagem Transferência Bancária / Transferência Financeira"
 * exportado em XLSX pelo sistema FATOR.
 *
 * Layout real (inspecionado do arquivo):
 *   Linha 0-4: cabeçalho do relatório
 *   Linha 5:   título + período (col 33: "Período: 01/01/2026 a 31/01/2026")
 *   Linha 6:   cabeçalho das colunas (células mescladas)
 *   Linhas 7+: pares alternados:
 *     - Linha de DADOS: col[2]=Data | col[5]=Órgão orig | col[8]=Conta orig |
 *                       col[19]=Fonte orig | col[23]=Órgão dest | col[24]=Conta dest |
 *                       col[30]=Fonte dest | col[32]=Nº Doc | col[35]=Tipo | col[36]=Valor
 *     - Linha VAZIA (skip)
 *     - Linha HISTÓRICO: col[0]="Histórico:" | col[5]=texto | col[33]=tipo lançamento
 *     - Linha VAZIA (skip)
 */

import * as XLSX from 'xlsx';
import type { RawTransfBancaria } from './transferenciaBancaria.extractor';

// Índices reais das colunas (baseado na inspeção do arquivo real)
const C_DATA        = 2;
const C_ORGAO_ORIG  = 5;
const C_CONTA_ORIG  = 8;
const C_FONTE_ORIG  = 19;
const C_ORGAO_DEST  = 23;
const C_CONTA_DEST  = 24;
const C_FONTE_DEST  = 30;
const C_NUM_DOC     = 32;
const C_TIPO_DOC    = 35;
const C_VALOR       = 36;
// Histórico (linha seguinte)
const C_HIST_LABEL  = 0;   // "Histórico:"
const C_HIST_TEXT   = 5;   // texto do histórico
const C_TIPO_LANC   = 33;  // "TRANSFERÊNCIA FINANCEIRA RECEBIDA"

export function extractTransfBancariaFromExcel(filePath: string): RawTransfBancaria[] {
  const wb = XLSX.readFile(filePath, { raw: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const allRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });

  // ── Período (linha 5, col 33 ou 34) ──────────────────────────────────────
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

  const results: RawTransfBancaria[] = [];

  for (let i = 7; i < allRows.length; i++) {
    const row = allRows[i];

    // ── Linha de DADOS: identificada pela presença de data numérica na col 2 ──
    const dataVal = row[C_DATA];
    if (typeof dataVal !== 'number' || dataVal < 40000) continue;

    const data_transf = parseExcelDate(dataVal);
    if (!data_transf) continue;

    const valor = parseValor(row[C_VALOR]);
    if (valor === 0) continue;

    const contaOrigRaw = String(row[C_CONTA_ORIG] ?? '').trim();
    const contaDestRaw = String(row[C_CONTA_DEST] ?? '').trim();
    const { codigo: conta_origem_codigo, nome: conta_origem_nome } = parseConta(contaOrigRaw);
    const { codigo: conta_destino_codigo, nome: conta_destino_nome } = parseConta(contaDestRaw);

    // ── Próximas linhas: vazia + histórico + vazia ────────────────────────
    let historico       = '';
    let tipo_lancamento = '';

    // Varre as próximas até 3 linhas buscando a de histórico
    for (let j = i + 1; j <= i + 3 && j < allRows.length; j++) {
      const nrow = allRows[j];
      const label = String(nrow[C_HIST_LABEL] ?? '').trim();
      if (/^Histórico[:\s]*/i.test(label)) {
        historico       = String(nrow[C_HIST_TEXT] ?? '').trim();
        tipo_lancamento = String(nrow[C_TIPO_LANC] ?? '').replace(/\s+/g, ' ').trim().toUpperCase();
        // Remove \r\n do fim
        tipo_lancamento = tipo_lancamento.replace(/[\r\n]+/g, '').trim();
        i = j; // avança o índice para não reprocessar
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

/** "15000000" → "1500" | "15001002" → "1500" — pega os 4 primeiros dígitos */
function normalizeFonte(raw: string): string {
  const digits = raw.trim().replace(/\D/g, '');
  return digits.slice(0, 4);
}

function parseOrgao(raw: any): number | null {
  const n = parseInt(String(raw ?? ''));
  return isNaN(n) ? null : n;
}

/**
 * "22039 -6  - ICMS"          → { codigo: "22039-6",       nome: "ICMS" }
 * "575244352-7 - PMI - FUNDO" → { codigo: "575244352-7",   nome: "PMI - FUNDO" }
 * "574427359-6 - RECURSOS PROPRIO FUS." → { codigo: "574427359-6", nome: "RECURSOS PROPRIO FUS." }
 */
function parseConta(raw: string): { codigo: string; nome: string } {
  if (!raw) return { codigo: '', nome: '' };
  // Normaliza múltiplos espaços + espaço antes/depois do traço numérico
  const s = raw.replace(/\s*-\s*(\d)/g, '-$1').replace(/\s+/g, ' ').trim();
  // Primeiro " - " que antecede texto (letra) é o separador código/nome
  const sep = s.search(/\s+-\s+[A-Za-zÀ-ÿ0-9]/);
  if (sep !== -1) {
    return {
      codigo: s.slice(0, sep).trim(),
      nome:   s.slice(sep).replace(/^\s*-\s*/, '').trim(),
    };
  }
  return { codigo: s, nome: '' };
}
