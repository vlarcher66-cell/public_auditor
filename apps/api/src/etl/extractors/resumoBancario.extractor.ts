import * as XLSX from 'xlsx';

export interface RawResumoBancario {
  num_ordem: string;
  nome_conta: string;
  saldo_anterior: number | null;
  creditos: number | null;
  debitos: number | null;
  saldo_atual: number | null;
}

/**
 * Extractor para "Resumo Bancário" exportado em XLSX.
 * Layout: cabeçalho na linha 2 (índice 1), dados a partir da linha 3 (índice 2).
 * Colunas: Nº Ordem | Nome | Totais | Saldo Anterior | Créditos | Débitos | Saldo Atual
 */
export function extractResumoBancarioFromExcel(filePath: string): RawResumoBancario[] {
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const allRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });

  // Detecta colunas dinamicamente pelo cabeçalho (linha 1, índice 1)
  const header = allRows[1]?.map((c: any) => String(c ?? '').trim().toLowerCase()) ?? [];

  let colOrdem      = 0;
  let colNome       = 1;
  let colSaldoAnt   = -1;
  let colCreditos   = -1;
  let colDebitos    = -1;
  let colSaldoAtual = -1;

  header.forEach((h, i) => {
    if (/n.*ordem/i.test(h) || h === 'nº de ordem') colOrdem = i;
    else if (/^nome/i.test(h)) colNome = i;
    else if (/saldo ant/i.test(h)) colSaldoAnt = i;
    else if (/cr[eé]dito/i.test(h)) colCreditos = i;
    else if (/d[eé]bito/i.test(h)) colDebitos = i;
    else if (/saldo atual/i.test(h)) colSaldoAtual = i;
  });

  // Fallback: assume posições fixas se não detectou
  if (colSaldoAnt   === -1) colSaldoAnt   = 3;
  if (colCreditos   === -1) colCreditos   = 4;
  if (colDebitos    === -1) colDebitos    = 5;
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

    const saldo_atual = parseValor(row[colSaldoAtual]);
    // Só inclui linhas que têm algum valor numérico
    const temValor = saldo_atual !== null
      || parseValor(row[colSaldoAnt]) !== null
      || parseValor(row[colCreditos]) !== null
      || parseValor(row[colDebitos]) !== null;

    if (!temValor) continue;

    rows.push({
      num_ordem:     String(row[colOrdem] ?? '').trim(),
      nome_conta:    nome,
      saldo_anterior: parseValor(row[colSaldoAnt]),
      creditos:       parseValor(row[colCreditos]),
      debitos:        parseValor(row[colDebitos]),
      saldo_atual:    parseValor(row[colSaldoAtual]),
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
