import * as XLSX from 'xlsx';

export interface RawResumoBancario {
  num_ordem: string;
  nome_conta: string;
  fonte: string | null;
  saldo_anterior: number | null;
  creditos: number | null;
  debitos: number | null;
  saldo_atual: number | null;
}

/**
 * Extractor para "Resumo Bancário" exportado em XLSX.
 * Layout: cabeçalho na linha 2 (índice 1), dados a partir da linha 3 (índice 2).
 * Colunas: Nº da Conta | Descrição | Fonte | Saldo Anterior | Débito | Crédito | Saldo Atual
 */
export function extractResumoBancarioFromExcel(filePath: string): RawResumoBancario[] {
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const allRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });

  // Detecta colunas dinamicamente pelo cabeçalho (linha 1, índice 1)
  const header = allRows[1]?.map((c: any) => String(c ?? '').trim().toLowerCase()) ?? [];

  let colOrdem      = 0;
  let colNome       = 1;
  let colFonte      = -1;
  let colSaldoAnt   = -1;
  let colDebitos    = -1;
  let colCreditos   = -1;
  let colSaldoAtual = -1;

  header.forEach((h, i) => {
    if (/n.*ordem|n.*conta/i.test(h))   colOrdem = i;
    else if (/descri|^nome/i.test(h))   colNome = i;
    else if (/^fonte/i.test(h))         colFonte = i;
    else if (/saldo ant/i.test(h))      colSaldoAnt = i;
    else if (/d[eé]bito/i.test(h))      colDebitos = i;
    else if (/cr[eé]dito/i.test(h))     colCreditos = i;
    else if (/saldo atual/i.test(h))    colSaldoAtual = i;
  });

  // Fallback: posições fixas baseadas no layout do relatório FATOR
  // Nº da Conta | Descrição | Fonte | Saldo Anterior | Débito | Crédito | Saldo Atual
  if (colFonte      === -1) colFonte      = 2;
  if (colSaldoAnt   === -1) colSaldoAnt   = 3;
  if (colDebitos    === -1) colDebitos    = 4;
  if (colCreditos   === -1) colCreditos   = 5;
  if (colSaldoAtual === -1) colSaldoAtual = 6;

  const rows: RawResumoBancario[] = [];

  // Dados a partir da linha 3 (índice 2)
  for (let i = 2; i < allRows.length; i++) {
    const row = allRows[i];

    const nome = String(row[colNome] ?? '').trim();
    if (!nome) continue;

    // Pula rodapé/totais gerais
    if (/^total\s+geral/i.test(nome) || /^totais/i.test(nome)) continue;
    if (/^(João|CPF|CRF|Prefeito|Secretar|Contador)/i.test(nome)) continue;

    const saldo_atual    = parseValor(row[colSaldoAtual]);
    const saldo_anterior = parseValor(row[colSaldoAnt]);
    const creditos       = parseValor(row[colCreditos]);
    const debitos        = parseValor(row[colDebitos]);

    const temValor = saldo_atual !== null || saldo_anterior !== null || creditos !== null || debitos !== null;
    if (!temValor) continue;

    rows.push({
      num_ordem:      String(row[colOrdem] ?? '').trim(),
      nome_conta:     nome,
      fonte:          String(row[colFonte] ?? '').trim() || null,
      saldo_anterior,
      creditos,
      debitos,
      saldo_atual,
    });
  }

  return rows;
}

function parseValor(raw: any): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw === 'number') return raw;
  const s = String(raw).trim().replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}
