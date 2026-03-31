/**
 * Extractor para o relatório "Listagem Transferência Bancária / Transferência Financeira"
 * exportado pelo sistema FATOR (SIAFIC — Fator Sistemas e Consultorias LTDA).
 *
 * Layout do PDF (por linha de dados):
 *   Data | Órgão | Conta Origem (CRÉDITO)  | Fonte Origem | Órgão | Conta Destino (DÉBITO) | Fonte Destino | Nº Documento Tipo | Valor
 *   Histórico: <texto>                                                                        TRANSFERÊNCIA FINANCEIRA RECEBIDA
 */
import * as fs from 'fs';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse');

export interface RawTransfBancaria {
  data_transf: string;           // "06/01/2026"
  orgao_origem: number | null;
  conta_origem_codigo: string;   // "22039-6"
  conta_origem_nome: string;     // "ICMS"
  fonte_origem: string;          // "15000000"
  orgao_destino: number | null;
  conta_destino_codigo: string;  // "31766-7"
  conta_destino_nome: string;    // "FUS."
  fonte_destino: string;         // "15001002"
  num_documento: string;         // "060125"
  tipo_documento: string;        // "DOC" | "TED"
  valor: string;                 // "14.267,88"
  historico: string;
  tipo_lancamento: string;       // "TRANSFERÊNCIA FINANCEIRA RECEBIDA"
  periodo_inicio: string;
  periodo_fim: string;
}

/**
 * Normaliza o código de conta que pode vir como "22039 •6 - ICMS" ou "22039-6 - ICMS".
 * Retorna { codigo, nome }
 */
function parseConta(raw: string): { codigo: string; nome: string } {
  // Remove bullet separador "•" e normaliza espaços
  const cleaned = raw.replace(/\s*[•·]\s*/g, '-').trim();
  // Formato: "CODIGO - NOME" ou só "CODIGO"
  const dashIdx = cleaned.indexOf(' - ');
  if (dashIdx !== -1) {
    return {
      codigo: cleaned.slice(0, dashIdx).trim(),
      nome:   cleaned.slice(dashIdx + 3).trim(),
    };
  }
  return { codigo: cleaned, nome: '' };
}

/**
 * Parse do período do cabeçalho: "Periodo: 01/01/2026 a 31/01/2026"
 */
function parsePeriodo(text: string): { inicio: string; fim: string } {
  const m = text.match(/Periodo[:\s]+(\d{2}\/\d{2}\/\d{4})\s+a\s+(\d{2}\/\d{2}\/\d{4})/i);
  if (m) return { inicio: m[1], fim: m[2] };
  return { inicio: '', fim: '' };
}

/**
 * Faz parse do valor brasileiro: "14.267,88" → "14267.88" (mantém como string p/ loader)
 */
function parseBrValue(raw: string): string {
  return raw.trim().replace(/\./g, '').replace(',', '.');
}

export async function extractTransfBancariaFromPdf(filePath: string): Promise<RawTransfBancaria[]> {
  const buffer = fs.readFileSync(filePath);
  const data   = await pdfParse(buffer);
  const lines  = data.text.split('\n').map((l: string) => l.trim()).filter(Boolean);

  // ── Período ────────────────────────────────────────────────────────────────
  const headerLine  = lines.find((l: string) => /Periodo[:\s]/i.test(l)) ?? '';
  const { inicio: periodo_inicio, fim: periodo_fim } = parsePeriodo(headerLine);

  const results: RawTransfBancaria[] = [];

  // ── Parse linha a linha ────────────────────────────────────────────────────
  // O relatório alterna entre:
  //   LINHA DE DADOS (começa com dd/mm/yyyy)
  //   LINHA DE HISTÓRICO (começa com "Histórico:" ou contém o histórico + tipo)
  //
  // Exemplo de tokens após split por espaços:
  //   ["06/01/2026", "2", "22039", "•6", "-", "ICMS", "15000000", "11", "31766", "•7", "-", "FUS.", "15001002", "060125", "DOC", "14.267,88"]
  //
  // O PDF ao ser parseado pode unir colunas em linha única. Usamos regex para capturar
  // o padrão fixo da linha de dados.

  // Regex: data | orgao_orig | conta_orig_cod | conta_orig_nome | fonte_orig | orgao_dest | conta_dest_cod | conta_dest_nome | fonte_dest | num_doc | tipo_doc | valor
  // A conta tem formato "NNNNN-N" possivelmente com espaços ao redor do traço
  // A fonte tem 8 dígitos
  const DATA_LINE_RE = /^(\d{2}\/\d{2}\/\d{4})\s+(\d+)\s+([\d\s•·-]+?)\s+-\s+(.+?)\s{2,}(\d{7,10})\s+(\d+)\s+([\d\s•·-]+?)\s+-\s+(.+?)\s{2,}(\d{7,10})\s+(\d+)\s+(DOC|TED|CHEQUE|TRANSF)\s+([\d.,]+)\s*$/i;

  // Regex alternativo mais flexível quando pdf-parse une tokens
  // Captura os campos numéricos fixos e texto entre eles
  const FLEX_RE = /^(\d{2}\/\d{2}\/\d{4})\s+(\d+)\s+(.+?)\s+(\d{7,10})\s+(\d+)\s+(.+?)\s+(\d{7,10})\s+(\d+)\s+(DOC|TED|CHEQUE|TRANSF)\s+([\d.,]+)$/i;

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Linha de data
    if (/^\d{2}\/\d{2}\/\d{4}/.test(line)) {
      let matched = false;

      // Tenta regex rígida
      let m = DATA_LINE_RE.exec(line);
      if (m) {
        const entry = buildEntry(m[1], m[2], m[3], m[4], m[5], m[6], m[7], m[8], m[9], m[10], m[11], m[12], periodo_inicio, periodo_fim);
        // Próxima linha pode ser histórico
        const next = lines[i + 1] ?? '';
        fillHistorico(entry, next);
        if (isHistoricoLine(next)) i++;
        results.push(entry);
        matched = true;
      }

      if (!matched) {
        // Tenta regex flexível
        m = FLEX_RE.exec(line);
        if (m) {
          // Divide conta_orig e conta_dest
          const { codigo: coOrig, nome: nmOrig } = parseConta(m[3]);
          const { codigo: coDest, nome: nmDest } = parseConta(m[6]);
          const entry: RawTransfBancaria = {
            data_transf: m[1],
            orgao_origem: parseInt(m[2]) || null,
            conta_origem_codigo: coOrig,
            conta_origem_nome:   nmOrig,
            fonte_origem:        m[4],
            orgao_destino:       parseInt(m[5]) || null,
            conta_destino_codigo: coDest,
            conta_destino_nome:  nmDest,
            fonte_destino:       m[7],
            num_documento:       m[8],
            tipo_documento:      m[9].toUpperCase(),
            valor:               parseBrValue(m[10]),
            historico:           '',
            tipo_lancamento:     '',
            periodo_inicio,
            periodo_fim,
          };
          const next = lines[i + 1] ?? '';
          fillHistorico(entry, next);
          if (isHistoricoLine(next)) i++;
          results.push(entry);
          matched = true;
        }
      }

      if (!matched) {
        // Fallback: parse manual por tokens para suportar variações de formatação do pdf-parse
        const parsed = parseDataLineManual(line, periodo_inicio, periodo_fim);
        if (parsed) {
          const next = lines[i + 1] ?? '';
          fillHistorico(parsed, next);
          if (isHistoricoLine(next)) i++;
          results.push(parsed);
        }
      }
    }
    i++;
  }

  return results;
}

function buildEntry(
  data: string, orgOrig: string, contaOrig: string, nomeOrig: string,
  fonteOrig: string, orgDest: string, contaDest: string, nomeDest: string,
  fonteDest: string, numDoc: string, tipoDoc: string, valor: string,
  pInicio: string, pFim: string,
): RawTransfBancaria {
  return {
    data_transf:          data,
    orgao_origem:         parseInt(orgOrig) || null,
    conta_origem_codigo:  contaOrig.replace(/\s*[•·]\s*/g, '-').trim(),
    conta_origem_nome:    nomeOrig.trim(),
    fonte_origem:         fonteOrig,
    orgao_destino:        parseInt(orgDest) || null,
    conta_destino_codigo: contaDest.replace(/\s*[•·]\s*/g, '-').trim(),
    conta_destino_nome:   nomeDest.trim(),
    fonte_destino:        fonteDest,
    num_documento:        numDoc,
    tipo_documento:       tipoDoc.toUpperCase(),
    valor:                parseBrValue(valor),
    historico:            '',
    tipo_lancamento:      '',
    periodo_inicio:       pInicio,
    periodo_fim:          pFim,
  };
}

function isHistoricoLine(line: string): boolean {
  return /^Hist[oó]rico[:\s]/i.test(line) || /TRANSFERÊNCIA\s+FINANCEIRA/i.test(line);
}

function fillHistorico(entry: RawTransfBancaria, nextLine: string): void {
  if (!nextLine) return;

  // Separa histórico do tipo de lançamento
  // Ex: "Histórico: REPASSE SAUDE COTA DARF.          TRANSFERÊNCIA FINANCEIRA RECEBIDA"
  const cleaned = nextLine.replace(/^Hist[oó]rico[:\s]*/i, '').trim();

  // A parte final em maiúsculas separada por 2+ espaços é o tipo
  const typeMatch = cleaned.match(/^(.+?)\s{2,}(TRANSFERÊNCIA\s+FINANCEIRA\s+\w+)\s*$/i);
  if (typeMatch) {
    entry.historico      = typeMatch[1].trim();
    entry.tipo_lancamento = typeMatch[2].trim().toUpperCase();
  } else if (/TRANSFERÊNCIA\s+FINANCEIRA/i.test(cleaned)) {
    entry.tipo_lancamento = cleaned.replace(/^.*?(TRANSFERÊNCIA\s+FINANCEIRA\s+\w+).*$/i, '$1').trim().toUpperCase();
    entry.historico       = cleaned.replace(/TRANSFERÊNCIA\s+FINANCEIRA\s+\w+/i, '').trim();
  } else {
    entry.historico = cleaned;
  }
}

/**
 * Fallback manual: tenta identificar campos pela posição de padrões fixos.
 * O layout tem: data(1) orgao(1) conta_codigo conta_nome fonte(8d) orgao(1) conta_codigo conta_nome fonte(8d) num_doc tipo_doc valor
 */
function parseDataLineManual(line: string, pInicio: string, pFim: string): RawTransfBancaria | null {
  // Extrai data no início
  const dateMatch = line.match(/^(\d{2}\/\d{2}\/\d{4})\s+/);
  if (!dateMatch) return null;

  // Extrai valor no final (número com vírgula no final da linha)
  const valorMatch = line.match(/([\d.]+,\d{2})\s*$/);
  if (!valorMatch) return null;

  // Extrai tipo de documento antes do valor
  const tipoDocMatch = line.match(/\s(DOC|TED|CHEQUE|TRANSF)\s+([\d.]+,\d{2})\s*$/i);
  if (!tipoDocMatch) return null;

  // Extrai fontes (padrão: 8 dígitos)
  const fontes = [...line.matchAll(/\b(\d{8})\b/g)].map(m => m[1]);
  if (fontes.length < 2) return null;

  // Extrai órgãos (números isolados de 1-2 dígitos, após a data)
  const restAfterDate = line.slice(dateMatch[0].length);
  const orgaos = [...restAfterDate.matchAll(/(?<!\d)(\d{1,2})(?!\d)/g)].map(m => parseInt(m[1]));

  // Extrai nº documento (antes do tipo DOC/TED)
  const numDocMatch = line.match(/\s(\d{6,10})\s+(DOC|TED|CHEQUE|TRANSF)\s/i);
  const numDoc = numDocMatch ? numDocMatch[1] : '';

  // Monta resultado com campos disponíveis (conta código/nome extraídos parcialmente)
  return {
    data_transf:          dateMatch[1],
    orgao_origem:         orgaos[0] ?? null,
    conta_origem_codigo:  '',
    conta_origem_nome:    '',
    fonte_origem:         fontes[0] ?? '',
    orgao_destino:        orgaos[1] ?? null,
    conta_destino_codigo: '',
    conta_destino_nome:   '',
    fonte_destino:        fontes[1] ?? '',
    num_documento:        numDoc,
    tipo_documento:       tipoDocMatch[1].toUpperCase(),
    valor:                parseBrValue(valorMatch[1]),
    historico:            '',
    tipo_lancamento:      '',
    periodo_inicio:       pInicio,
    periodo_fim:          pFim,
  };
}
