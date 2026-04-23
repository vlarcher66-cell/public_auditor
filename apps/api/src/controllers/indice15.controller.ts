import { Request, Response } from 'express';
import { db } from '../config/database';
import { isSuperAdmin } from '../config/roles';

// Prefixos de rubricas que compõem a base de cálculo dos 15% (LC 141/2012)
const BASE_PREFIXES = [
  '1.1.1',        // Impostos próprios (IPTU, ISS, ITBI, IRRF, etc.)
  '1.7.1.1.51',   // FPM - Cota Mensal
  '1.7.1.1.52',   // ITR
  '1.7.1.9.58',   // LC 176/2020
  '1.7.2.1.50',   // ICMS
  '1.7.2.1.51',   // IPVA
  '1.7.2.1.52',   // IPI Exportação
];
const DEDUCAO_PREFIXES = [
  '9.7.1.1.51', '9.7.1.1.52',
  '9.7.2.1.50', '9.7.2.1.51', '9.7.2.1.52',
];

// Mapeamento de rubricas para nomes amigáveis
const RUBRICA_LABELS: Record<string, string> = {
  '1.1.1.2.50': 'IPTU',
  '1.1.1.2.53': 'ITBI',
  '1.1.1.3.03': 'IRRF',
  '1.1.1.4.51': 'ISS',
  '1.1.1.9.99': 'Outros Impostos',
  '1.7.1.1.51': 'FPM',
  '1.7.1.1.52': 'ITR',
  '1.7.1.9.58': 'LC 176/2020',
  '1.7.2.1.50': 'ICMS',
  '1.7.2.1.51': 'IPVA',
  '1.7.2.1.52': 'IPI Exportação',
};

function getRubricaLabel(cod: string): string {
  for (const [prefix, label] of Object.entries(RUBRICA_LABELS)) {
    if (cod.startsWith(prefix)) return label;
  }
  return cod.slice(0, 14);
}

export async function getIndice15(req: Request, res: Response): Promise<void> {
  const ano = parseInt(req.query.ano as string) || new Date().getFullYear();
  const user = (req as any).user;

  // Para o índice 15%, o filtro é SEMPRE por município — nunca por entidade isolada,
  // pois o cálculo envolve Prefeitura (base) + Fundo (aplicado) de forma consolidada.
  const applyRBAC = (q: any) => {
    if (!isSuperAdmin(user?.role) && user?.fk_municipio) q.where('r.fk_municipio', user.fk_municipio);
    return q;
  };

  // Receitas da Prefeitura (base de cálculo)
  const prefRows: any[] = await applyRBAC(
    db('fact_receita as r')
      .join('dim_entidade as e', 'r.fk_entidade', 'e.id')
      .where('r.ano', ano)
      .where('e.tipo', 'PREFEITURA')
      .select('r.codigo_rubrica', 'r.descricao', 'r.mes')
      .sum('r.valor as total')
      .groupBy('r.codigo_rubrica', 'r.descricao', 'r.mes')
  );

  // Repasse ao Fundo de Saúde — via transferências bancárias importadas com entidade FUNDO
  const saudeRows: any[] = await applyRBAC(
    db('fact_transf_bancaria as r')
      .join('dim_entidade as e', 'r.fk_entidade', 'e.id')
      .where('r.ano', ano)
      .where('e.tipo', 'FUNDO')
      .select('r.mes')
      .sum('r.valor as total')
      .groupBy('r.mes')
  );

  // Monta matriz mensal
  const meses = Array.from({ length: 12 }, (_, i) => i + 1);

  const matrix = meses.map(mes => {
    const baseRows = prefRows.filter(r =>
      r.mes === mes && BASE_PREFIXES.some(p => r.codigo_rubrica.startsWith(p))
    );
    const dedRows = prefRows.filter(r =>
      r.mes === mes && DEDUCAO_PREFIXES.some(p => r.codigo_rubrica.startsWith(p))
    );

    const baseBruta  = baseRows.reduce((s, r) => s + Number(r.total), 0);
    const deducoes   = dedRows.reduce((s, r) => s + Number(r.total), 0); // negativo
    const baseCalc   = baseBruta + deducoes;
    const saude      = Number(saudeRows.find(r => r.mes === mes)?.total ?? 0);
    const minimo     = baseCalc * 0.15;
    const superavit  = saude - minimo;
    const percentual = baseCalc > 0 ? (saude / baseCalc) * 100 : 0;

    // Detalhe por rubrica agrupado
    const detalhe: Record<string, number> = {};
    for (const r of baseRows) {
      const label = getRubricaLabel(r.codigo_rubrica);
      detalhe[label] = (detalhe[label] ?? 0) + Number(r.total);
    }
    // Aplicar deduções
    for (const r of dedRows) {
      for (const [prefix, label] of Object.entries(RUBRICA_LABELS)) {
        if (r.codigo_rubrica.replace('9.', '1.').startsWith(prefix) ||
            r.codigo_rubrica.startsWith('9.7' + prefix.slice(1))) {
          detalhe[label] = (detalhe[label] ?? 0) + Number(r.total);
          break;
        }
      }
    }

    return { mes, baseCalc, baseBruta, deducoes, saude, minimo, superavit, percentual, detalhe, temDados: baseCalc > 0 || saude > 0 };
  });

  // Acumulado
  const acumulado = matrix.reduce((acc, m) => ({
    baseCalc:   acc.baseCalc   + m.baseCalc,
    saude:      acc.saude      + m.saude,
    minimo:     acc.minimo     + m.minimo,
    superavit:  acc.superavit  + m.superavit,
    percentual: 0,
  }), { baseCalc: 0, saude: 0, minimo: 0, superavit: 0, percentual: 0 });
  acumulado.percentual = acumulado.baseCalc > 0
    ? (acumulado.saude / acumulado.baseCalc) * 100 : 0;

  // Detalhe anual por rubrica
  const detalheAnual: Record<string, number> = {};
  for (const m of matrix) {
    for (const [k, v] of Object.entries(m.detalhe)) {
      detalheAnual[k] = (detalheAnual[k] ?? 0) + v;
    }
  }

  res.json({ ano, matrix, acumulado, detalheAnual });
}
