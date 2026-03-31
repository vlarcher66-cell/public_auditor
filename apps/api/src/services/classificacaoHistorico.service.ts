import { db } from '../config/database';
import { logger } from '../config/logger';

export interface ClassificacaoResult {
  fk_grupo: number | null;
  fk_subgrupo: number | null;
  grupo_nome: string | null;
  subgrupo_nome: string | null;
  confianca: 'alta' | 'media' | 'baixa' | 'nenhuma';
  motivo: string;
  palavrasEncontradas: string[];
}

interface MatchResult {
  subgrupoNome: string;
  fk_subgrupo: number;
  fk_grupo: number;
  score: number;
  palavrasEncontradas: string[];
}

/**
 * Normaliza texto: lowercase + remove acentos + remove pontuação
 */
export function normalizarTexto(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ');
}

/**
 * Função genérica: analisa histórico e classifica em grupo + subgrupo
 * buscando tokens dos NOMES DOS SUBGRUPOS dentro do histórico.
 * Funciona para qualquer grupo (diárias, pessoal, etc.)
 */
export async function classificarPorHistorico(
  historico: string | null | undefined,
  grupoNomeLike: string,  // ex: '%DIÁRIA%' ou '%PESSOAL%'
  prefixoRemover?: string // ex: 'FOPAG' — remove do nome do subgrupo antes de tokenizar
): Promise<ClassificacaoResult> {
  if (!historico || historico.trim().length === 0) {
    return { fk_grupo: null, fk_subgrupo: null, grupo_nome: null, subgrupo_nome: null, confianca: 'nenhuma', motivo: 'Histórico vazio', palavrasEncontradas: [] };
  }

  const historicoNorm = normalizarTexto(historico);
  const historicoTokens = historicoNorm.split(/\s+/).filter(t => t.length > 1);

  // Busca subgrupos do grupo no banco
  const subgrupos = await db('dim_subgrupo_despesa as s')
    .join('dim_grupo_despesa as g', 's.fk_grupo', 'g.id')
    .where('g.nome', 'like', grupoNomeLike)
    .select('s.id as fk_subgrupo', 's.nome as subgrupo_nome', 'g.id as fk_grupo', 'g.nome as grupo_nome');

  if (subgrupos.length === 0) {
    return { fk_grupo: null, fk_subgrupo: null, grupo_nome: null, subgrupo_nome: null, confianca: 'nenhuma', motivo: 'Nenhum subgrupo encontrado no banco', palavrasEncontradas: [] };
  }

  const matches: MatchResult[] = [];

  for (const subgrupo of subgrupos) {
    // Extrai tokens do nome do subgrupo removendo prefixo e palavras curtas
    let nomeParaTokenizar = normalizarTexto(subgrupo.subgrupo_nome);
    if (prefixoRemover) {
      nomeParaTokenizar = nomeParaTokenizar.replace(normalizarTexto(prefixoRemover), '');
    }

    const tokensSubgrupo = nomeParaTokenizar
      .split(/[\s\-\/]+/)
      .map(t => t.trim())
      .filter(t => t.length > 1); // tokens com mais de 1 caractere

    if (tokensSubgrupo.length === 0) continue;

    // Encontra tokens do subgrupo presentes no histórico
    const palavrasEncontradas = tokensSubgrupo.filter(token =>
      historicoTokens.some(ht => ht === token || ht.includes(token) || token.includes(ht))
    );

    if (palavrasEncontradas.length === 0) continue;

    // Score: proporção de tokens encontrados — peso extra se encontrou mais de 1
    const score = palavrasEncontradas.length >= 2 ? 1.0 : 0.85;

    matches.push({
      subgrupoNome: subgrupo.subgrupo_nome,
      fk_subgrupo: subgrupo.fk_subgrupo,
      fk_grupo: subgrupo.fk_grupo,
      score,
      palavrasEncontradas,
    });
  }

  if (matches.length === 0) {
    return { fk_grupo: null, fk_subgrupo: null, grupo_nome: null, subgrupo_nome: null, confianca: 'nenhuma', motivo: 'Nenhuma correspondência encontrada', palavrasEncontradas: [] };
  }

  // Melhor match por score e quantidade de palavras
  matches.sort((a, b) => b.score - a.score || b.palavrasEncontradas.length - a.palavrasEncontradas.length);
  const melhor = matches[0];

  const confianca: 'alta' | 'media' | 'baixa' = melhor.score >= 0.9 ? 'alta' : melhor.score >= 0.5 ? 'media' : 'baixa';

  const grupo = await db('dim_grupo_despesa').where('id', melhor.fk_grupo).first();

  logger.info({ historico: historico.substring(0, 80), subgrupo: melhor.subgrupoNome, confianca }, 'Classificado por histórico');

  return {
    fk_grupo: melhor.fk_grupo,
    fk_subgrupo: melhor.fk_subgrupo,
    grupo_nome: grupo?.nome || null,
    subgrupo_nome: melhor.subgrupoNome,
    confianca,
    motivo: `${melhor.palavrasEncontradas.length} token(s) do subgrupo encontrado(s) no histórico`,
    palavrasEncontradas: melhor.palavrasEncontradas,
  };
}

/**
 * Lista credores sem subgrupo que têm pagamentos com o elemento informado
 * e já têm o grupo classificado
 */
export async function listarCredoresParaConfirmar(
  elementoCodigo: string,  // ex: '3.3.90.14%' ou '3.1.90.11%'
  grupoNomeLike: string,   // ex: '%DIÁRIA%' ou '%PESSOAL%'
  grupoNomeLike2?: string, // segundo padrão opcional
  page = 1,
  limit = 10
): Promise<{ rows: any[]; total: number }> {
  const offset = (page - 1) * limit;

  const base = () => db('dim_credor as c')
    .join('dim_grupo_despesa as g', 'c.fk_grupo', 'g.id')
    .whereNull('c.fk_subgrupo')
    .where(function () {
      this.where('g.nome', 'like', grupoNomeLike);
      if (grupoNomeLike2) this.orWhere('g.nome', 'like', grupoNomeLike2);
    })
    .whereExists(
      db('fact_ordem_pagamento as f')
        .join('dim_elemento_despesa as el', 'f.fk_elemento_despesa', 'el.id')
        .where('f.fk_credor', db.raw('c.id'))
        .where('el.codigo', 'like', elementoCodigo)
        .select(db.raw('1'))
    );

  const [rows, [{ total }]] = await Promise.all([
    base().select('c.id', 'c.nome', 'c.historico', 'c.fk_grupo', 'g.nome as grupo_nome').orderBy('c.nome').limit(limit).offset(offset),
    base().count('c.id as total'),
  ]);

  return { rows, total: Number(total) };
}
