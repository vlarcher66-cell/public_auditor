import { db } from '../config/database';
import { logger } from '../config/logger';

export interface ClassificacaoDiariaResult {
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
 * Analisa o histórico de um pagamento e classifica em grupo + subgrupo de diárias
 * Busca palavras-chave EXTRAÍDAS DOS NOMES DOS SUBGRUPOS dentro do histórico
 */
export async function classificarDiariasPorHistorico(historico: string | null | undefined): Promise<ClassificacaoDiariaResult> {
  if (!historico || historico.trim().length === 0) {
    return {
      fk_grupo: null,
      fk_subgrupo: null,
      grupo_nome: null,
      subgrupo_nome: null,
      confianca: 'nenhuma',
      motivo: 'Histórico vazio ou não informado',
      palavrasEncontradas: [],
    };
  }

  // Normaliza o histórico (lowercase, remove acentos)
  const historicoNormalizado = normalizarTexto(historico);
  const historicoTokens = historicoNormalizado.split(/\s+/).filter((t) => t.length > 0);

  // Busca todos os subgrupos de diárias no banco
  const subgruposDiarias = await db('dim_subgrupo_despesa as s')
    .join('dim_grupo_despesa as g', 's.fk_grupo', 'g.id')
    .where(function () {
      this.where('g.nome', 'like', '%DIÁRIA%').orWhere('g.nome', 'like', '%DIARIA%');
    })
    .select('s.id as fk_subgrupo', 's.nome as subgrupo_nome', 'g.id as fk_grupo', 'g.nome as grupo_nome');

  if (subgruposDiarias.length === 0) {
    return {
      fk_grupo: null,
      fk_subgrupo: null,
      grupo_nome: null,
      subgrupo_nome: null,
      confianca: 'nenhuma',
      motivo: 'Nenhum subgrupo de diárias encontrado no banco',
      palavrasEncontradas: [],
    };
  }

  // Mapeamento de palavras-chave que podem aparecer no histórico → subgrupos
  const padroesPorPalavra: Record<string, { keywords: string[]; subgrupoPattern: string }> = {
    motorista: {
      keywords: ['motorista', 'motoristas', 'condutor', 'condutor'],
      subgrupoPattern: 'MOTORISTA',
    },
    coordenador: {
      keywords: ['coordenador', 'coordenadores', 'supervisor', 'supervisores'],
      subgrupoPattern: 'COORDENADOR',
    },
    professor: {
      keywords: ['professor', 'professora', 'prof', 'docente', 'docentes'],
      subgrupoPattern: 'PROF',
    },
    secretario: {
      keywords: ['secretario', 'secretaria', 'secretário', 'secretária'],
      subgrupoPattern: 'SECRETÁRIO',
    },
    servidor: {
      keywords: ['servidor', 'servidores', 'funcionario', 'funcionarios', 'funcionário', 'funcionários'],
      subgrupoPattern: 'SERVIDOR',
    },
    assistente: {
      keywords: ['assistente', 'assistentes', 'auxiliar', 'auxiliares'],
      subgrupoPattern: 'ASSISTENTE',
    },
  };

  // Calcula score para cada subgrupo
  const matches: MatchResult[] = [];

  for (const [palavraChave, padrao] of Object.entries(padroesPorPalavra)) {
    // Procura palavras-chave no histórico
    const palavrasEncontradas = padrao.keywords.filter((kw) =>
      historicoTokens.some((token) => token.includes(kw.toLowerCase()))
    );

    if (palavrasEncontradas.length === 0) continue;

    // Busca o subgrupo correspondente
    const subgrupoMatch = subgruposDiarias.find((s) =>
      normalizarTexto(s.subgrupo_nome).includes(padrao.subgrupoPattern.toLowerCase())
    );

    if (!subgrupoMatch) continue;

    // Score: cada grupo tem palavra única → encontrou 1 keyword específica = alta confiança
    // Quanto mais keywords encontradas = mais certeza ainda
    const score = palavrasEncontradas.length >= 2 ? 1.0 : 0.85;

    matches.push({
      subgrupoNome: subgrupoMatch.subgrupo_nome,
      fk_subgrupo: subgrupoMatch.fk_subgrupo,
      fk_grupo: subgrupoMatch.fk_grupo,
      score,
      palavrasEncontradas,
    });
  }

  // Se nenhum match foi encontrado
  if (matches.length === 0) {
    return {
      fk_grupo: null,
      fk_subgrupo: null,
      grupo_nome: null,
      subgrupo_nome: null,
      confianca: 'nenhuma',
      motivo: 'Nenhuma correspondência encontrada entre histórico e subgrupos',
      palavrasEncontradas: [],
    };
  }

  // Ordena por score (descendente) e pega o melhor match
  matches.sort((a, b) => b.score - a.score);
  const melhorMatch = matches[0];

  // Determina o nível de confiança
  let confianca: 'alta' | 'media' | 'baixa' | 'nenhuma' = 'nenhuma';
  if (melhorMatch.score >= 0.8) {
    confianca = 'alta';
  } else if (melhorMatch.score >= 0.5) {
    confianca = 'media';
  } else if (melhorMatch.score > 0) {
    confianca = 'baixa';
  }

  // Busca o nome do grupo no banco
  const grupo = await db('dim_grupo_despesa').where('id', melhorMatch.fk_grupo).first();

  logger.info(
    {
      historico: historico.substring(0, 100),
      subgrupo: melhorMatch.subgrupoNome,
      confianca,
      score: melhorMatch.score.toFixed(2),
      palavrasEncontradas: melhorMatch.palavrasEncontradas,
    },
    'Diária classificada'
  );

  return {
    fk_grupo: melhorMatch.fk_grupo,
    fk_subgrupo: melhorMatch.fk_subgrupo,
    grupo_nome: grupo?.nome || null,
    subgrupo_nome: melhorMatch.subgrupoNome,
    confianca,
    motivo: `Encontradas ${melhorMatch.palavrasEncontradas.length}/${melhorMatch.palavrasEncontradas.length + (Object.values(matches[0]).length - 3)} palavras-chave do subgrupo no histórico`,
    palavrasEncontradas: melhorMatch.palavrasEncontradas,
  };
}

/**
 * Normaliza texto removendo acentos e convertendo para lowercase
 */
function normalizarTexto(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^\w\s]/g, ' '); // Remove pontuação, mantém espaços
}

/**
 * Classifica um credor de diárias automaticamente baseado em seu histórico
 */
export async function classificarCredorDiarias(credorId: number): Promise<{ atualizado: boolean; resultado: ClassificacaoDiariaResult }> {
  const credor = await db('dim_credor').where('id', credorId).first();
  if (!credor) {
    return {
      atualizado: false,
      resultado: {
        fk_grupo: null,
        fk_subgrupo: null,
        grupo_nome: null,
        subgrupo_nome: null,
        confianca: 'nenhuma',
        motivo: 'Credor não encontrado',
        palavrasEncontradas: [],
      },
    };
  }

  const resultado = await classificarDiariasPorHistorico(credor.historico);

  // Só atualiza se tiver confiança alta ou média
  if (resultado.confianca === 'alta' || resultado.confianca === 'media') {
    await db('dim_credor').where('id', credorId).update({
      fk_grupo: resultado.fk_grupo,
      fk_subgrupo: resultado.fk_subgrupo,
      precisa_reclassificacao: false,
    });

    logger.info(
      { credorId, credor: credor.nome, ...resultado },
      'Credor de diária classificado automaticamente'
    );

    return {
      atualizado: true,
      resultado,
    };
  }

  return {
    atualizado: false,
    resultado,
  };
}

/**
 * Classifica todos os credores de diárias que ainda não têm classificação
 * Usada durante/após importação
 */
export async function classificarTodosCredoresDiarias(): Promise<{ processados: number; atualizados: number; detalhes: any[] }> {
  // Busca credores que têm pagamentos com elemento 3.3.90.14 mas ainda não têm grupo
  const creditosParaClassificar = await db('dim_credor as c')
    .whereNull('c.fk_grupo')
    .whereExists(
      db('fact_ordem_pagamento as f')
        .join('dim_elemento_despesa as el', 'f.fk_elemento_despesa', 'el.id')
        .where('f.fk_credor', db.raw('c.id'))
        .where('el.codigo', 'like', '3.3.90.14%')
    )
    .select('c.id', 'c.nome', 'c.historico');

  if (creditosParaClassificar.length === 0) {
    return { processados: 0, atualizados: 0, detalhes: [] };
  }

  let atualizados = 0;
  const detalhes: any[] = [];

  for (const credor of creditosParaClassificar) {
    const { atualizado, resultado } = await classificarCredorDiarias(credor.id);
    if (atualizado) {
      atualizados++;
    }
    detalhes.push({
      credorId: credor.id,
      credorNome: credor.nome,
      atualizado,
      resultado,
    });
  }

  logger.info(
    { processados: creditosParaClassificar.length, atualizados, detalhes },
    'Classificação de credores de diárias concluída'
  );

  return {
    processados: creditosParaClassificar.length,
    atualizados,
    detalhes,
  };
}
