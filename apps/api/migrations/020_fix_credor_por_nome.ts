import { Knex } from 'knex';

/**
 * Migration 020 — Corrige credores duplicados por CNPJ
 *
 * Problema: o loader criava um único credor por CNPJ, ignorando o nome.
 * Resultado: "FUNDO MUNICIPAL DE SAÚDE - PSFs", "FUNDO MUNICIPAL DE SAÚDE - HGI" etc.
 * ficavam todos apontando para o mesmo credor em dim_credor.
 *
 * Solução:
 *  1. Lê todos os pares distintos (credor_nome, credor_cnpj_cpf_norm) de fact_ordem_pagamento
 *  2. Para cada par que não tem credor correspondente em dim_credor (cnpj_norm + nome),
 *     cria um novo credor copiando a classificação (fk_grupo, fk_subgrupo) do credor
 *     existente com o mesmo CNPJ (preserva trabalho manual já feito)
 *  3. Atualiza fk_credor em fact_ordem_pagamento para apontar ao credor correto por nome
 */
export async function up(knex: Knex): Promise<void> {
  // Normaliza CNPJ/CPF (só dígitos) — mesma lógica do transformer
  function normDoc(doc: string | null): string {
    if (!doc) return '';
    return doc.replace(/\D/g, '');
  }

  // 1. Busca todos os pares distintos nome+cnpj presentes nos pagamentos
  const pares: { credor_nome: string; credor_cnpj_cpf: string }[] = await knex('fact_ordem_pagamento')
    .whereNotNull('credor_nome')
    .whereNotNull('credor_cnpj_cpf')
    .select(
      knex.raw('TRIM(credor_nome) as credor_nome'),
      knex.raw('credor_cnpj_cpf'),
    )
    .groupByRaw('TRIM(credor_nome), credor_cnpj_cpf');

  // 2. Carrega credores existentes
  const credoresExistentes: { id: number; nome: string; cnpj_cpf_norm: string; cnpj_cpf: string; tipo_doc: string; fk_grupo: number | null; fk_subgrupo: number | null; historico: string | null }[] =
    await knex('dim_credor').select('id', 'nome', 'cnpj_cpf_norm', 'cnpj_cpf', 'tipo_doc', 'fk_grupo', 'fk_subgrupo', 'historico');

  // Mapa: cnpj_norm+nome_upper → id
  const credorPorNomeMap = new Map<string, number>();
  for (const c of credoresExistentes) {
    credorPorNomeMap.set(`${c.cnpj_cpf_norm}||${c.nome.trim().toUpperCase()}`, c.id);
  }

  // Mapa: cnpj_norm → credor (para copiar classificação)
  const credorPorCnpjMap = new Map<string, typeof credoresExistentes[0]>();
  for (const c of credoresExistentes) {
    if (!credorPorCnpjMap.has(c.cnpj_cpf_norm)) {
      credorPorCnpjMap.set(c.cnpj_cpf_norm, c);
    }
  }

  let criados = 0;
  let atualizados = 0;

  for (const par of pares) {
    const nome = par.credor_nome.trim();
    const cnpjNorm = normDoc(par.credor_cnpj_cpf);
    const chave = `${cnpjNorm}||${nome.toUpperCase()}`;

    // Já existe credor com esse nome+cnpj?
    if (credorPorNomeMap.has(chave)) continue;

    // Busca credor pai (mesmo CNPJ) para herdar classificação
    const pai = credorPorCnpjMap.get(cnpjNorm);

    // Cria novo credor
    const [novoId] = await knex('dim_credor').insert({
      nome,
      cnpj_cpf: par.credor_cnpj_cpf,
      cnpj_cpf_norm: cnpjNorm,
      tipo_doc: pai?.tipo_doc ?? (cnpjNorm.length === 11 ? 'CPF' : 'CNPJ'),
      fk_grupo: pai?.fk_grupo ?? null,
      fk_subgrupo: pai?.fk_subgrupo ?? null,
      historico: pai?.historico ?? null,
      precisa_reclassificacao: false,
    });

    credorPorNomeMap.set(chave, novoId);
    criados++;
  }

  // 3. Atualiza fk_credor em fact_ordem_pagamento para apontar ao credor correto
  // Processa em lotes para não travar o banco
  const pagamentos: { id: number; credor_nome: string; credor_cnpj_cpf: string }[] =
    await knex('fact_ordem_pagamento')
      .whereNotNull('credor_nome')
      .whereNotNull('credor_cnpj_cpf')
      .select('id', 'credor_nome', 'credor_cnpj_cpf');

  const BATCH = 500;
  for (let i = 0; i < pagamentos.length; i += BATCH) {
    const lote = pagamentos.slice(i, i + BATCH);
    for (const p of lote) {
      const nome = p.credor_nome.trim();
      const cnpjNorm = normDoc(p.credor_cnpj_cpf);
      const chave = `${cnpjNorm}||${nome.toUpperCase()}`;
      const credorId = credorPorNomeMap.get(chave);
      if (!credorId) continue;

      await knex('fact_ordem_pagamento')
        .where('id', p.id)
        .where('fk_credor', '!=', credorId) // só atualiza se necessário
        .update({ fk_credor: credorId });
      atualizados++;
    }
  }

  console.log(`[020] Credores criados: ${criados} | Pagamentos corrigidos: ${atualizados}`);
}

export async function down(_knex: Knex): Promise<void> {
  // Não é seguro reverter — os credores criados podem ter classificações manuais
  console.log('[020] down: não reversível automaticamente');
}
