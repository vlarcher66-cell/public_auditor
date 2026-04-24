import { Request, Response } from 'express';
import { db } from '../config/database';
import { isSuperAdmin } from '../config/roles';

const BASE_PREFIXES = [
  '1.1.1', '1.7.1.1.51', '1.7.1.1.52', '1.7.1.9.58',
  '1.7.2.1.50', '1.7.2.1.51', '1.7.2.1.52',
];
const DEDUCAO_PREFIXES = [
  '9.7.1.1.51', '9.7.1.1.52', '9.7.2.1.50', '9.7.2.1.51', '9.7.2.1.52',
];

const QUADRIMESTRES: Record<number, { label: string; meses: number[] }> = {
  1: { label: '1º Quadrimestre (Jan–Abr)', meses: [1, 2, 3, 4] },
  2: { label: '2º Quadrimestre (Mai–Ago)', meses: [5, 6, 7, 8] },
  3: { label: '3º Quadrimestre (Set–Dez)', meses: [9, 10, 11, 12] },
};

const MESES_LABEL = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export async function getRelatorioQuadrimestral(req: Request, res: Response): Promise<void> {
  try {
  const ano  = parseInt(req.query.ano  as string) || new Date().getFullYear();
  const quad = parseInt(req.query.quad as string) || 1;
  const user = (req as any).user;

  const qInfo = QUADRIMESTRES[quad];
  if (!qInfo) { res.status(400).json({ error: 'Quadrimestre inválido (1-3)' }); return; }

  const meses = qInfo.meses;

  const applyRBAC = (q: any, alias = 'r') => {
    if (!isSuperAdmin(user?.role) && user?.fk_municipio)
      q.where(`${alias}.fk_municipio`, user.fk_municipio);
    return q;
  };

  // ── 1. Receitas da Prefeitura (base de cálculo 15%) ──────────────────────────
  const prefRows: any[] = await applyRBAC(
    db('fact_receita as r')
      .join('dim_entidade as e', 'r.fk_entidade', 'e.id')
      .where('r.ano', ano)
      .whereIn('r.mes', meses)
      .where('e.tipo', 'PREFEITURA')
      .select('r.codigo_rubrica', 'r.descricao', 'r.mes')
      .sum('r.valor as total')
      .groupBy('r.codigo_rubrica', 'r.descricao', 'r.mes')
  );

  // ── 2. Repasse ao Fundo de Saúde via transferências bancárias (Opção A — consistente com saude-15) ──
  const saudeReceitaRows: any[] = await applyRBAC(
    db('fact_transf_bancaria as r')
      .join('dim_entidade as e', 'r.fk_entidade', 'e.id')
      .where('r.ano', ano)
      .whereIn('r.mes', meses)
      .where('e.tipo', 'FUNDO')
      .select('r.mes')
      .sum('r.valor as total')
      .groupBy('r.mes')
  );

  // ── 3. Despesas pagas do Fundo de Saúde ─────────────────────────────────────
  const despesaRows: any[] = await applyRBAC(
    db('fact_ordem_pagamento as r')
      .join('dim_entidade as e', 'r.fk_entidade', 'e.id')
      .leftJoin('dim_credor as c', 'r.fk_credor', 'c.id')
      .leftJoin('dim_grupo_despesa as g', 'c.fk_grupo', 'g.id')
      .leftJoin('dim_subgrupo_despesa as s', 'c.fk_subgrupo', 's.id')
      .whereRaw('EXTRACT(YEAR FROM r.data_pagamento) = ?', [ano])
      .whereRaw(`EXTRACT(MONTH FROM r.data_pagamento) = ANY(ARRAY[${meses.join(',')}]::int[])`)
      .where('e.tipo', 'FUNDO')
      .select(
        db.raw('EXTRACT(MONTH FROM r.data_pagamento) as mes'),
        db.raw("COALESCE(g.nome, 'Sem Grupo') as grupo_nome"),
        db.raw("COALESCE(s.nome, 'Sem Subgrupo') as subgrupo_nome"),
        'c.nome as credor_nome',
      )
      .sum('r.valor_liquido as total')
      .count('r.id as qtd')
      .groupByRaw('EXTRACT(MONTH FROM r.data_pagamento), g.nome, s.nome, c.nome')
      .orderBy('total', 'desc'),
    'r'
  );

  // ── 4. Top credores pagos no quadrimestre ────────────────────────────────────
  const topCredores: any[] = await applyRBAC(
    db('fact_ordem_pagamento as r')
      .join('dim_entidade as e', 'r.fk_entidade', 'e.id')
      .leftJoin('dim_credor as c', 'r.fk_credor', 'c.id')
      .leftJoin('dim_grupo_despesa as g', 'c.fk_grupo', 'g.id')
      .whereRaw('EXTRACT(YEAR FROM r.data_pagamento) = ?', [ano])
      .whereRaw(`EXTRACT(MONTH FROM r.data_pagamento) = ANY(ARRAY[${meses.join(',')}]::int[])`)
      .where('e.tipo', 'FUNDO')
      .select(
        db.raw("COALESCE(c.nome, r.credor_nome, 'Desconhecido') as credor_nome"),
        db.raw("COALESCE(g.nome, 'Sem Grupo') as grupo_nome"),
      )
      .sum('r.valor_liquido as total')
      .count('r.id as qtd')
      .groupByRaw("COALESCE(c.nome, r.credor_nome, 'Desconhecido'), g.nome")
      .orderBy('total', 'desc')
      .limit(15),
    'r'
  );

  // ── 5. Monta índice 15% por mês ───────────────────────────────────────────────
  const indice15Meses = meses.map(mes => {
    const baseRows = prefRows.filter(r =>
      Number(r.mes) === mes && BASE_PREFIXES.some(p => r.codigo_rubrica?.startsWith(p))
    );
    const dedRows = prefRows.filter(r =>
      Number(r.mes) === mes && DEDUCAO_PREFIXES.some(p => r.codigo_rubrica?.startsWith(p))
    );
    const saude = Number(saudeReceitaRows.find(r => Number(r.mes) === mes)?.total ?? 0);

    const baseBruta = baseRows.reduce((s, r) => s + Number(r.total), 0);
    const deducoes  = dedRows.reduce((s, r) => s + Number(r.total), 0);
    const baseCalc  = baseBruta + deducoes;
    const minimo    = baseCalc * 0.15;
    const superavit = saude - minimo;
    const pct       = baseCalc > 0 ? (saude / baseCalc) * 100 : 0;

    return { mes, label: MESES_LABEL[mes], baseCalc, saude, minimo, superavit, pct, temDados: baseCalc > 0 || saude > 0 };
  });

  const indice15Acum = indice15Meses.reduce((acc, m) => ({
    baseCalc:  acc.baseCalc  + m.baseCalc,
    saude:     acc.saude     + m.saude,
    minimo:    acc.minimo    + m.minimo,
    superavit: acc.superavit + m.superavit,
    pct: 0,
  }), { baseCalc: 0, saude: 0, minimo: 0, superavit: 0, pct: 0 });
  indice15Acum.pct = indice15Acum.baseCalc > 0
    ? (indice15Acum.saude / indice15Acum.baseCalc) * 100 : 0;

  // ── 6. Despesas agrupadas por grupo (consolidado) ────────────────────────────
  const despesaPorGrupo: Record<string, number> = {};
  for (const r of despesaRows) {
    const k = r.grupo_nome;
    despesaPorGrupo[k] = (despesaPorGrupo[k] ?? 0) + Number(r.total);
  }
  const despesaGrupos = Object.entries(despesaPorGrupo)
    .map(([nome, total]) => ({ nome, total }))
    .sort((a, b) => b.total - a.total);

  // ── 7. Despesas por mês (evolução) ───────────────────────────────────────────
  const despesaPorMes = meses.map(mes => ({
    mes,
    label: MESES_LABEL[mes],
    total: despesaRows
      .filter(r => Number(r.mes) === mes)
      .reduce((s, r) => s + Number(r.total), 0),
  }));

  // ── 8. Repasse ao Fundo por mês ──────────────────────────────────────────────
  const receitaPorMes = meses.map(mes => ({
    mes,
    label: MESES_LABEL[mes],
    total: Number(saudeReceitaRows.find(r => Number(r.mes) === mes)?.total ?? 0),
  }));

  const totalReceitas = receitaPorMes.reduce((s, m) => s + m.total, 0);
  const totalDespesas = despesaPorMes.reduce((s, m) => s + m.total, 0);

  res.json({
    ano,
    quad,
    quadLabel: qInfo.label,
    meses: meses.map(m => ({ mes: m, label: MESES_LABEL[m] })),
    // KPIs
    totalReceitas,
    totalDespesas,
    saldo: totalReceitas - totalDespesas,
    indice15: indice15Acum,
    // Séries mensais
    indice15Meses,
    receitaPorMes,
    despesaPorMes,
    // Detalhes
    despesaGrupos,
    topCredores: topCredores.map(r => ({
      credor_nome: r.credor_nome,
      grupo_nome:  r.grupo_nome,
      total:       Number(r.total),
      qtd:         Number(r.qtd),
    })),
  });
  } catch (err: any) {
    res.status(500).json({ error: 'Erro ao gerar relatório', detail: err?.message });
  }
}
