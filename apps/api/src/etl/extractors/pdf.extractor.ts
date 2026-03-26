import * as fs from 'fs';
import type { RawOrdemPagamento } from '@public-auditor/shared';

const TIPO_RE = /Ordinário\/Normal|Ordinario\/Normal|Estimativo|Global|Suplementação|Complementação/;
const DATA_ROW_RE = /^\d{4}\.\d{2}\.\d{8}/;

export async function extractFromPdf(filePath: string): Promise<RawOrdemPagamento[]> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pdfParse = require('pdf-parse');
  const buffer = fs.readFileSync(filePath);
  const data = await pdfParse(buffer);

  const rawLines: string[] = data.text
    .split('\n')
    .map((l: string) => l.trim())
    .filter((l: string) => l.length > 0);

  // Extract metadata from header (first 10 lines)
  const headerText = rawLines.slice(0, 10).join(' ');
  const cnpjMatch = headerText.match(/CNPJ[:\s]*([\d.\/\-]+)/i);
  const periodMatch = headerText.match(/([\d]{2}\/[\d]{2}\/[\d]{4})\s+a\s+([\d]{2}\/[\d]{2}\/[\d]{4})/);
  const entidade_nome = rawLines[0]?.trim() || '';
  const entidade_cnpj = cnpjMatch?.[1]?.trim() || '';
  const periodo_inicio = periodMatch?.[1] || '';
  const periodo_fim = periodMatch?.[2] || '';

  // Merge continuation lines: data lines that don't contain tipo_empenho
  // get their next lines appended until they're complete
  const mergedRows: Array<{ line: string; historico: string }> = [];
  let i = 0;
  while (i < rawLines.length) {
    const line = rawLines[i];
    if (DATA_ROW_RE.test(line)) {
      let merged = line;
      while (!TIPO_RE.test(merged)) {
        const next = rawLines[i + 1];
        if (!next) break;
        // Stop if next line is a new data row, page header, or historico line
        if (
          DATA_ROW_RE.test(next) ||
          /^Vl de Pessoal|^Hist[oó]rico|^Página:|^FUNDO MUNICIPAL|^PRAÇA|^CNPJ:|^LISTAGEM|^Período:|^Data$|^Pagamento$|^Empenho$|^Despesa$|^SIAFIC|^Sub-Total|^Total/i.test(next)
        ) {
          break;
        }
        // Skip isolated short numbers (page numbers, footnotes) — e.g. "1", "42"
        if (/^\d{1,3}$/.test(next)) { i++; continue; }
        merged += next;
        i++;
      }

      // Look ahead for Histórico content
      // The pattern is: data row → immediately next line(s) contain the description/historico
      // Stop collecting when we hit "Vl de Pessoal:" or a new data row
      let historico = '';
      let j = i + 1;
      let historicoLines: string[] = [];

      while (j < rawLines.length && j < i + 15) {
        const candidate = rawLines[j];

        // Stop at page/section markers or new data row
        if (DATA_ROW_RE.test(candidate) || /^Página:|^Sub-Total|^Total Geral|^FUNDO MUNICIPAL|^PRAÇA|^LISTAGEM|^SIAFIC/i.test(candidate)) {
          break;
        }

        // Stop at "Vl de Pessoal:" marker (end of description)
        if (/^Vl de Pessoal/i.test(candidate)) {
          break;
        }

        // Collect lines that look like description text (uppercase, starts with letter or common text)
        if (candidate.length > 0 && /^[A-ZÁÉÍÓÚÃÕÇ]/.test(candidate)) {
          historicoLines.push(candidate);
        }

        j++;
      }

      // Join collected lines as historico
      if (historicoLines.length > 0) {
        historico = historicoLines.join(' ').trim();
        i = j - 1;
      }

      mergedRows.push({ line: merged, historico });
    }
    i++;
  }

  const rows: RawOrdemPagamento[] = [];
  for (const { line, historico } of mergedRows) {
    const parsed = parsePdfDataLine(line);
    if (parsed) {
      rows.push({
        ...parsed,
        valor_pessoal: '0',
        historico,
        entidade_nome,
        entidade_cnpj,
        periodo_inicio,
        periodo_fim,
      });
    }
  }

  return rows;
}

function parsePdfDataLine(
  line: string,
): Omit<RawOrdemPagamento, 'valor_pessoal' | 'historico' | 'entidade_nome' | 'entidade_cnpj' | 'periodo_inicio' | 'periodo_fim'> | null {
  // 1. reduzido: NNNN.NN.NNNNNNNN
  const reduzidoM = line.match(/^(\d{4}\.\d{2}\.\d{8})/);
  if (!reduzidoM) return null;
  const reduzido = reduzidoM[1];
  let rest = line.slice(reduzido.length);

  // 2. valor_liquido (BRL number immediately after reduzido, e.g., "2.340,62")
  const vliqM = rest.match(/^([\d.]*\d,\d{2})/);
  if (!vliqM) return null;
  const valor_liquido = vliqM[1];
  rest = rest.slice(valor_liquido.length);

  // 3. classificacao orçamentária: "1101  2.083  3.3.90.92.00  15001002"
  // fonte_recurso is always 8 digits — use \d{8} to avoid consuming digits from the following date
  const classifM = rest.match(/^(\d{4}\s{1,4}\d+\.\d+\s{1,4}[\d.]+\s{1,4}\d{8})/);
  if (!classifM) return null;
  const classificacao_orcamentaria = classifM[1].trim();
  rest = rest.slice(classifM[0].length);

  // 4. data_pagamento dd/mm/yyyy
  const dataPagM = rest.match(/^(\d{2}\/\d{2}\/\d{4})/);
  if (!dataPagM) return null;
  const data_pagamento = dataPagM[1];
  rest = rest.slice(data_pagamento.length);

  // 5. num_empenho (digits + optional /digits)
  const empM = rest.match(/^(\d+(?:\/\d+)?)/);
  if (!empM) return null;
  const num_empenho = empM[1];
  rest = rest.slice(num_empenho.length);

  // 6. credor (everything before tipo_empenho keyword)
  const tipoM = rest.match(TIPO_RE);
  if (!tipoM || tipoM.index === undefined) return null;
  const credor = rest.slice(0, tipoM.index).trim();
  const tipo_empenho = tipoM[0];
  rest = rest.slice(tipoM.index + tipo_empenho.length);

  // 7. num_processo (12 digits)
  const procM = rest.match(/^(\d{12})/);
  if (!procM) return null;
  const num_processo = procM[1];
  rest = rest.slice(num_processo.length);

  // 8. data_empenho
  const dataEmpM = rest.match(/^(\d{2}\/\d{2}\/\d{4})/);
  if (!dataEmpM) return null;
  const data_empenho = dataEmpM[1];
  rest = rest.slice(data_empenho.length);

  // 9. data_liquidacao
  const dataLiqM = rest.match(/^(\d{2}\/\d{2}\/\d{4})/);
  if (!dataLiqM) return null;
  const data_liquidacao = dataLiqM[1];
  rest = rest.slice(data_liquidacao.length);

  // 10. CNPJ or CPF
  const cnpjM = rest.match(/^(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{3}\.\d{3}\.\d{3}-\d{2})/);
  if (!cnpjM) return null;
  const cnpj_cpf = cnpjM[1];
  rest = rest.slice(cnpj_cpf.length);

  // 11. valor_retido
  const vRetM = rest.match(/^([\d.]*\d,\d{2})/);
  if (!vRetM) return null;
  const valor_retido = vRetM[1];
  rest = rest.slice(valor_retido.length);

  // 12. valor_bruto (remaining BRL number)
  const vBrutoM = rest.match(/^([\d.]*\d,\d{2})/);
  const valor_bruto = vBrutoM ? vBrutoM[1] : valor_liquido;

  return {
    reduzido,
    num_empenho,
    classificacao_orcamentaria,
    credor,
    cnpj_cpf,
    tipo_empenho,
    data_pagamento,
    data_empenho,
    data_liquidacao,
    num_processo,
    valor_bruto,
    valor_retido,
    valor_liquido,
  };
}
