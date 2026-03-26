export interface OrdemPagamento {
  id: number;
  num_empenho: string;
  num_empenho_base?: string | null;
  reduzido: number;
  num_processo: string | null;
  historico: string | null;
  data_pagamento: string; // ISO date
  data_empenho: string | null;
  data_liquidacao: string | null;
  valor_bruto: number;
  valor_retido: number;
  valor_liquido: number;
  valor_pessoal: number;
  sub_elemento: number | null;
  // Joins
  entidade_nome?: string;
  entidade_cnpj?: string;
  credor_nome?: string;
  credor_cnpj?: string;
  credor_cnpj_cpf?: string;
  grupo_nome?: string | null;
  subgrupo_nome?: string | null;
  // Classificação por pagamento (quando credor tem detalhar_no_pagamento = true)
  detalhar_no_pagamento?: boolean;
  fk_grupo_pag?: number | null;
  fk_subgrupo_pag?: number | null;
  grupo_pag_nome?: string | null;
  subgrupo_pag_nome?: string | null;
  tipo_relatorio?: string;
  fk_setor_pag?: number | null;
  setor_nome?: string | null;
  tipo_empenho?: string;
  elemento_despesa?: string;
  fonte_recurso?: string;
  acao?: string;
  unidade_orcamentaria?: string;
  unidade_orcamentaria_codigo?: number;
  unidade_gestora_codigo?: number;
  acao_codigo?: string;
  elemento_despesa_codigo?: string;
  fonte_recurso_codigo?: string;
  periodo_inicio?: string;
  periodo_fim?: string;
  has_rateio?: number; // 1 se possui rateio_itens, 0 caso contrário
}

export interface OrdemPagamentoFiltros {
  dataInicio?: string;
  dataFim?: string;
  credorId?: number;
  entidadeId?: number;
  elementoDespesa?: string;
  fonteRecurso?: string;
  tipoEmpenho?: string;
  numEmpenho?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

export interface OrdemPagamentoSummary {
  totalBruto: number;
  totalRetido: number;
  totalLiquido: number;
  countRegistros: number;
  topCredores: Array<{ nome: string; total: number }>;
  byElementoDespesa: Array<{ codigo: string; total: number }>;
  byFonteRecurso: Array<{ codigo: string; total: number }>;
}

export interface RawOrdemPagamento {
  data_pagamento: string;
  num_empenho: string;
  reduzido: string;
  classificacao_orcamentaria: string;
  credor: string;
  cnpj_cpf: string;
  tipo_empenho: string;
  data_empenho: string;
  data_liquidacao: string;
  num_processo: string;
  valor_bruto: string;
  valor_retido: string;
  valor_liquido: string;
  valor_pessoal: string;
  historico: string;
  // Parsed from header
  entidade_nome: string;
  entidade_cnpj: string;
  periodo_inicio: string;
  periodo_fim: string;
}

export interface ClassificacaoOrcamentaria {
  unidade_orcamentaria: number;
  sub_elemento: number;
  unidade_gestora: number;
  acao: string;
  elemento_despesa: string;
  fonte_recurso: string;
  raw: string;
}
