import * as crypto from 'crypto';
import type { RawOrdemPagamento } from '@public-auditor/shared';
import { parseClassificacao } from './classificacao.parser';

export interface TransformedOrdemPagamento {
  // Header metadata
  entidade_nome: string;
  entidade_cnpj: string;
  entidade_cnpj_norm: string;
  periodo_inicio: Date;
  periodo_fim: Date;

  // Payment fields
  data_pagamento: Date;
  num_empenho: string;
  num_empenho_base: string;
  reduzido: number;
  reduzido_raw: string;
  num_processo: string;
  historico: string;

  // Dates
  data_empenho: Date | null;
  data_liquidacao: Date | null;

  // Values
  valor_bruto: number;
  valor_retido: number;
  valor_liquido: number;
  valor_pessoal: number;

  // Creditor
  credor_nome: string;
  cnpj_cpf: string;
  cnpj_cpf_norm: string;
  tipo_doc: 'CNPJ' | 'CPF' | 'OUTRO';

  // Budget classification
  unidade_orcamentaria: number;
  sub_elemento: number;
  unidade_gestora: number;
  acao: string;
  elemento_despesa: string;
  fonte_recurso: string;

  // Commitment type
  tipo_empenho: string;

  // Deduplication
  hash_linha: string;
}

export function transformOrdemPagamento(raw: RawOrdemPagamento): TransformedOrdemPagamento {
  const data_pagamento = parseDateBR(raw.data_pagamento);
  const data_empenho = raw.data_empenho ? parseDateBR(raw.data_empenho) : null;
  const data_liquidacao = raw.data_liquidacao ? parseDateBR(raw.data_liquidacao) : null;
  const periodo_inicio = parseDateBR(raw.periodo_inicio);
  const periodo_fim = parseDateBR(raw.periodo_fim);

  const valor_bruto = parseCurrencyBR(raw.valor_bruto);
  const valor_retido = parseCurrencyBR(raw.valor_retido);
  const valor_liquido = parseCurrencyBR(raw.valor_liquido);
  const valor_pessoal = parseCurrencyBR(raw.valor_pessoal || '0');

  const cnpj_cpf_norm = normalizeCnpjCpf(raw.cnpj_cpf);
  const tipo_doc = detectTipoDoc(cnpj_cpf_norm);
  const entidade_cnpj_norm = normalizeCnpjCpf(raw.entidade_cnpj);

  const classificacao = parseClassificacao(raw.classificacao_orcamentaria, raw.reduzido);

  const reduzido = extractReduzido(raw.reduzido);
  const num_empenho_base = extractEmpenhoBase(raw.num_empenho);

  const tipo_empenho = normalizeTipoEmpenho(raw.tipo_empenho);

  // Canonical hash for deduplication
  const hashInput = [
    raw.data_pagamento,
    raw.num_empenho,
    raw.num_processo,
    raw.valor_bruto,
    raw.valor_liquido,
    cnpj_cpf_norm,
    entidade_cnpj_norm,
  ].join('|');
  const hash_linha = crypto.createHash('sha256').update(hashInput).digest('hex');

  return {
    entidade_nome: raw.entidade_nome.trim(),
    entidade_cnpj: raw.entidade_cnpj.trim(),
    entidade_cnpj_norm,
    periodo_inicio,
    periodo_fim,
    data_pagamento,
    num_empenho: raw.num_empenho.trim(),
    num_empenho_base,
    reduzido,
    reduzido_raw: raw.reduzido,
    num_processo: raw.num_processo?.trim() || '',
    historico: raw.historico?.trim() || '',
    data_empenho,
    data_liquidacao,
    valor_bruto,
    valor_retido,
    valor_liquido,
    valor_pessoal,
    credor_nome: raw.credor.trim(),
    cnpj_cpf: raw.cnpj_cpf.trim(),
    cnpj_cpf_norm,
    tipo_doc,
    unidade_orcamentaria: classificacao.unidade_orcamentaria,
    sub_elemento: classificacao.sub_elemento,
    unidade_gestora: classificacao.unidade_gestora,
    acao: classificacao.acao,
    elemento_despesa: classificacao.elemento_despesa,
    fonte_recurso: classificacao.fonte_recurso,
    tipo_empenho,
    hash_linha,
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Parses Brazilian date "dd/mm/yyyy" → Date */
export function parseDateBR(str: string): Date {
  const m = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) throw new Error(`Data inválida: "${str}"`);
  return new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]));
}

/** Parses Brazilian currency "1.234,56" or plain "1234.56" → number */
export function parseCurrencyBR(str: string): number {
  if (!str) return 0;
  const s = str.toString().trim();
  if (!s || s === '-') return 0;
  // If it contains a comma, treat as BR format (dot=thousands, comma=decimal)
  if (s.includes(',')) {
    const clean = s.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
    return parseFloat(clean) || 0;
  }
  // Otherwise treat as plain numeric (from XLSX raw values)
  return parseFloat(s.replace(/[^\d.-]/g, '')) || 0;
}

/** Removes all non-digit chars from CNPJ/CPF */
export function normalizeCnpjCpf(str: string): string {
  return (str || '').replace(/\D/g, '').slice(0, 14);
}

function detectTipoDoc(norm: string): 'CNPJ' | 'CPF' | 'OUTRO' {
  if (norm.length === 14) return 'CNPJ';
  if (norm.length === 11) return 'CPF';
  return 'OUTRO';
}

/** Extrai o número base do empenho: "23/21" → "23", "288" → "288", "224/1" → "224" */
function extractEmpenhoBase(numEmpenho: string): string {
  const s = (numEmpenho || '').trim();
  const idx = s.indexOf('/');
  return idx >= 0 ? s.slice(0, idx).trim() : s;
}

function extractReduzido(reduzidoRaw: string): number {
  // "2083.92.15001002" → first numeric part before the dot
  const m = reduzidoRaw.match(/^(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

function normalizeTipoEmpenho(raw: string): string {
  const s = (raw || '').toUpperCase().trim();
  if (s.includes('GLOBAL')) return 'GLOBAL';
  if (s.includes('ESTIMAT')) return 'ESTIMATIVO';
  if (s.includes('ORDIN') || s.includes('NORMAL')) return 'ORDINARIO';
  return s || 'ORDINARIO';
}
