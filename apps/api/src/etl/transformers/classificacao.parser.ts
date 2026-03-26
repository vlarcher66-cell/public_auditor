import type { ClassificacaoOrcamentaria } from '@public-auditor/shared';

/**
 * Faz o parse da string de Classificação Orçamentária do SIAFIC.
 *
 * Formatos observados no PDF:
 *   "2083.92.15001002 1101 2.083 3.3.90.92.00 15001002"
 *   Reduzido parte: "2083.92.15001002" → unidade=2083, sub=92, fonte_red=15001002
 *   Restante: "1101 2.083 3.3.90.92.00 15001002"
 *     unidade_gestora=1101, acao=2.083, elemento=3.3.90.92.00, fonte=15001002
 *
 * A string recebida já vem sem o campo reduzido principal (separado antes).
 * Ex de entrada: "1101 2.083 3.3.90.92.00 15001002"
 */
export function parseClassificacao(
  raw: string,
  reduzidoRaw: string,
): ClassificacaoOrcamentaria {
  // Parse reduzido field: "NNNN.SS.FFFFFFFF"
  let unidade_orcamentaria = 0;
  let sub_elemento = 0;

  const redParts = reduzidoRaw.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (redParts) {
    unidade_orcamentaria = parseInt(redParts[1], 10);
    sub_elemento = parseInt(redParts[2], 10);
  }

  // Parse classification string: "1101 2.083 3.3.90.92.00 15001002"
  const tokens = raw.trim().split(/\s+/);

  let unidade_gestora = 0;
  let acao = '';
  let elemento_despesa = '';
  let fonte_recurso = '';

  // Token patterns:
  // unidade_gestora: 4-digit number (e.g., 1101)
  // acao: N.NNN format (e.g., 2.038)
  // elemento_despesa: N.N.NN.NN.NN format (e.g., 3.3.90.92.00)
  // fonte_recurso: 8+ digit number (e.g., 15001002)

  for (const token of tokens) {
    if (/^\d{4}$/.test(token) && unidade_gestora === 0) {
      unidade_gestora = parseInt(token, 10);
    } else if (/^\d\.\d{3}$/.test(token) && !acao) {
      acao = token;
    } else if (/^\d\.\d\.\d{2}\.\d{2}\.\d{2}$/.test(token) && !elemento_despesa) {
      elemento_despesa = token;
    } else if (/^\d{8,}$/.test(token) && !fonte_recurso) {
      fonte_recurso = token;
    }
  }

  // Fallback: if parsing failed, try positional approach
  if (!acao && tokens.length >= 4) {
    unidade_gestora = parseInt(tokens[0], 10) || 0;
    acao = tokens[1] || '';
    elemento_despesa = tokens[2] || '';
    fonte_recurso = tokens[3] || '';
  }

  return {
    unidade_orcamentaria,
    sub_elemento,
    unidade_gestora,
    acao,
    elemento_despesa,
    fonte_recurso,
    raw: `${reduzidoRaw} ${raw}`.trim(),
  };
}
