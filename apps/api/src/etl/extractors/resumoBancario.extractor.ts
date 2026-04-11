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

  // Layout real do FATOR (com células mescladas):
  // A(0)=Nº da Conta | B(1)=Descrição | C(2)=vazia | D(3)=Fonte | E(4)=vazia | F(5)=Saldo Anterior | G(6)=Débito | H(7)=Crédito | I(8)=Saldo Atual
  let colOrdem      = 0;
  let colNome       = 1;
  let colFonte      = 3;
  let colSaldoAnt   = 5;
  let colDebitos    = 6;
  let colCreditos   = 7;
  let colSaldoAtual = 8;

  // Tenta detectar pelo cabeçalho (caso o layout mude)
  header.forEach((h, i) => {
    if (/n.*conta|n.*ordem/i.test(h))  colOrdem = i;
    else if (/descri/i.test(h))        colNome = i;
    else if (/^fonte/i.test(h))        colFonte = i;
    else if (/saldo\s*ant/i.test(h))   colSaldoAnt = i;
    else if (/d[eé]bito/i.test(h))     colDebitos = i;
    else if (/cr[eé]dito/i.test(h))    colCreditos = i;
    else if (/saldo\s*atual/i.test(h)) colSaldoAtual = i;
  });

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
