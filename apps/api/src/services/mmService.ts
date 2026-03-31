/**
 * MM Service — Motor de Classificação Grupo/Subgrupo por Credor
 *
 * Lógica:
 * 1. Busca credores sem grupo (ou sem subgrupo)
 * 2. Para cada credor, coleta os históricos dos seus pagamentos
 * 3. Dupla validação:
 *    - Análise 1: match contra subgrupos → sobe para grupo pai
 *    - Análise 2: match contra grupos → desce para subgrupos filhos
 * 4. Calcula % de confiança e retorna sugestões
 */

import { db } from '../config/database';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface MMSugestao {
  credor_id: number;
  credor_nome: string;
  historicos: string[];
  grupo_id: number;
  grupo_nome: string;
  subgrupo_id: number | null;
  subgrupo_nome: string | null;
  confianca: number;          // 0-100
  nivel: 'verde' | 'amarelo' | 'vermelho' | 'preto';
  ja_classificado: boolean;
}

// ─── Helpers de texto ─────────────────────────────────────────────────────────

/**
 * Normaliza texto: remove acentos, deixa maiúsculo, remove pontuação extra
 */
function normalizar(texto: string): string {
  return texto
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extrai palavras com 3+ caracteres (ignora palavras genéricas)
 */
const STOP_WORDS = new Set([
  'DE', 'DA', 'DO', 'DAS', 'DOS', 'EM', 'NO', 'NA', 'NOS', 'NAS',
  'A', 'O', 'AS', 'OS', 'UM', 'UMA', 'E', 'COM', 'POR', 'PARA',
  'AO', 'AOS', 'REF', 'NF', 'NFS', 'NOTA', 'FISCAL', 'PAGAMENTO',
  'PAG', 'SERV', 'SERVICO', 'SERVICOS', 'LTDA', 'ME', 'EPP', 'EIRELI',
]);

function extrairPalavras(texto: string): string[] {
  return normalizar(texto)
    .split(' ')
    .filter(p => p.length >= 3 && !STOP_WORDS.has(p));
}

/**
 * Calcula score de similaridade entre histórico e nome do grupo/subgrupo
 * Retorna 0-100
 */
function calcularScore(historico: string, nome: string): number {
  const palavrasNome = extrairPalavras(nome);
  if (palavrasNome.length === 0) return 0;

  const historicoNorm = normalizar(historico);
  let matches = 0;

  for (const palavra of palavrasNome) {
    if (historicoNorm.includes(palavra)) {
      matches++;
    }
  }

  return Math.round((matches / palavrasNome.length) * 100);
}

/**
 * Calcula score médio de uma lista de históricos contra um nome
 */
function scoreHistoricos(historicos: string[], nome: string): number {
  if (historicos.length === 0) return 0;
  const scores = historicos.map(h => calcularScore(h, nome));
  const melhor = Math.max(...scores);
  const media = scores.reduce((a, b) => a + b, 0) / scores.length;
  // Peso: 70% melhor score + 30% média
  return Math.round(melhor * 0.7 + media * 0.3);
}

/**
 * Define nível de confiança baseado no %
 */
function definirNivel(confianca: number): MMSugestao['nivel'] {
  if (confianca >= 85) return 'verde';
  if (confianca >= 60) return 'amarelo';
  if (confianca >= 40) return 'vermelho';
  return 'preto';
}

// ─── Função principal ─────────────────────────────────────────────────────────

/**
 * Executa o MM para todos os credores sem grupo
 * Retorna lista de sugestões ordenadas por confiança
 */
export async function executarMM(): Promise<{
  sugestoes: MMSugestao[];
  resumo: { total: number; verde: number; amarelo: number; vermelho: number; preto: number; sem_sugestao: number };
}> {
  // 1. Busca credores sem grupo
  const credoresSemGrupo = await db('dim_credor as c')
    .whereNull('c.fk_grupo')
    .select('c.id', 'c.nome', 'c.historico');

  if (credoresSemGrupo.length === 0) {
    return {
      sugestoes: [],
      resumo: { total: 0, verde: 0, amarelo: 0, vermelho: 0, preto: 0, sem_sugestao: 0 },
    };
  }

  // 2. Busca todos os grupos e subgrupos do banco
  const [grupos, subgrupos] = await Promise.all([
    db('dim_grupo_despesa').select('id', 'nome'),
    db('dim_subgrupo_despesa').select('id', 'nome', 'fk_grupo'),
  ]);

  // 3. Busca históricos dos pagamentos de cada credor
  const credorIds = credoresSemGrupo.map((c: any) => c.id);

  const historicoPagamentos = await db('fact_ordem_pagamento')
    .whereIn('fk_credor', credorIds)
    .whereNotNull('historico')
    .where('historico', '!=', '')
    .select('fk_credor', 'historico')
    .limit(50000);

  // Agrupa históricos por credor
  const historicosPorCredor = new Map<number, string[]>();
  for (const p of historicoPagamentos) {
    const lista = historicosPorCredor.get(p.fk_credor) || [];
    // Evita duplicatas
    if (!lista.includes(p.historico)) {
      lista.push(p.historico);
    }
    historicosPorCredor.set(p.fk_credor, lista);
  }

  // 4. Para cada credor, calcula sugestão
  const sugestoes: MMSugestao[] = [];

  for (const credor of credoresSemGrupo) {
    // Coleta históricos: histórico do credor + históricos dos pagamentos
    const historicos: string[] = [];
    if (credor.historico) historicos.push(credor.historico);
    const histPag = historicosPorCredor.get(credor.id) || [];
    historicos.push(...histPag.slice(0, 20)); // máximo 20 históricos

    if (historicos.length === 0) continue;

    // Análise 1: match contra subgrupos → pega grupo pai
    let melhorSubgrupo: any = null;
    let melhorScoreSubgrupo = 0;

    for (const sub of subgrupos) {
      const score = scoreHistoricos(historicos, sub.nome);
      if (score > melhorScoreSubgrupo) {
        melhorScoreSubgrupo = score;
        melhorSubgrupo = sub;
      }
    }

    // Análise 2: match direto contra grupos
    let melhorGrupo: any = null;
    let melhorScoreGrupo = 0;

    for (const grupo of grupos) {
      const score = scoreHistoricos(historicos, grupo.nome);
      if (score > melhorScoreGrupo) {
        melhorScoreGrupo = score;
        melhorGrupo = grupo;
      }
    }

    // 5. Compara as duas análises e decide
    let grupoFinal: any = null;
    let subgrupoFinal: any = null;
    let confiancaFinal = 0;

    if (melhorScoreSubgrupo >= melhorScoreGrupo && melhorSubgrupo) {
      // Subgrupo ganhou — usa grupo pai do subgrupo
      const grupoPai = grupos.find((g: any) => g.id === melhorSubgrupo.fk_grupo);
      if (grupoPai) {
        grupoFinal = grupoPai;
        subgrupoFinal = melhorSubgrupo;
        // Confiança: média das duas análises
        const scoreGrupoPai = scoreHistoricos(historicos, grupoPai.nome);
        confiancaFinal = Math.round((melhorScoreSubgrupo * 0.6 + scoreGrupoPai * 0.4));
      }
    } else if (melhorGrupo) {
      // Grupo ganhou — tenta encontrar subgrupo dentro desse grupo
      grupoFinal = melhorGrupo;
      const subgruposMesmoGrupo = subgrupos.filter((s: any) => s.fk_grupo === melhorGrupo.id);

      if (subgruposMesmoGrupo.length > 0) {
        let melhorSubDoGrupo: any = null;
        let melhorScoreSubDoGrupo = 0;
        for (const sub of subgruposMesmoGrupo) {
          const score = scoreHistoricos(historicos, sub.nome);
          if (score > melhorScoreSubDoGrupo) {
            melhorScoreSubDoGrupo = score;
            melhorSubDoGrupo = sub;
          }
        }
        if (melhorScoreSubDoGrupo >= 40) {
          subgrupoFinal = melhorSubDoGrupo;
          confiancaFinal = Math.round((melhorScoreGrupo * 0.5 + melhorScoreSubDoGrupo * 0.5));
        } else {
          confiancaFinal = Math.round(melhorScoreGrupo * 0.7);
        }
      } else {
        confiancaFinal = Math.round(melhorScoreGrupo * 0.7);
      }
    }

    // Só inclui se tiver grupo definido e confiança mínima
    if (!grupoFinal || confiancaFinal < 20) continue;

    sugestoes.push({
      credor_id: credor.id,
      credor_nome: credor.nome,
      historicos: historicos.slice(0, 5), // retorna até 5 históricos
      grupo_id: grupoFinal.id,
      grupo_nome: grupoFinal.nome,
      subgrupo_id: subgrupoFinal?.id || null,
      subgrupo_nome: subgrupoFinal?.nome || null,
      confianca: confiancaFinal,
      nivel: definirNivel(confiancaFinal),
      ja_classificado: false,
    });
  }

  // Ordena por confiança decrescente
  sugestoes.sort((a, b) => b.confianca - a.confianca);

  // Resumo
  const resumo = {
    total: sugestoes.length,
    verde: sugestoes.filter(s => s.nivel === 'verde').length,
    amarelo: sugestoes.filter(s => s.nivel === 'amarelo').length,
    vermelho: sugestoes.filter(s => s.nivel === 'vermelho').length,
    preto: sugestoes.filter(s => s.nivel === 'preto').length,
    sem_sugestao: credoresSemGrupo.length - sugestoes.length,
  };

  return { sugestoes, resumo };
}

/**
 * Aplica as sugestões confirmadas — atualiza dim_credor em lote
 */
export async function aplicarSugestoesMM(
  confirmados: Array<{ credor_id: number; grupo_id: number; subgrupo_id: number | null }>
): Promise<{ atualizados: number }> {
  if (confirmados.length === 0) return { atualizados: 0 };

  let atualizados = 0;

  for (const item of confirmados) {
    await db('dim_credor').where({ id: item.credor_id }).update({
      fk_grupo: item.grupo_id,
      fk_subgrupo: item.subgrupo_id || null,
      precisa_reclassificacao: false,
    });
    atualizados++;
  }

  return { atualizados };
}
