import { Knex } from 'knex';

/**
 * Migration 021 — Troca constraint única de dim_credor
 *
 * Antes: UNIQUE (cnpj_cpf_norm, historico_hash)
 * Depois: UNIQUE (cnpj_cpf_norm, nome) — chave correta para credores distintos por CNPJ+nome
 */
export async function up(knex: Knex): Promise<void> {
  // Remove constraint antiga
  await knex.schema.alterTable('dim_credor', (t) => {
    t.dropUnique(['cnpj_cpf_norm', 'historico_hash'], 'dim_credor_cnpj_historico_uq');
  });

  // Adiciona constraint correta
  await knex.schema.alterTable('dim_credor', (t) => {
    t.unique(['cnpj_cpf_norm', 'nome'], { indexName: 'dim_credor_cnpj_nome_uq' });
  });

  console.log('[021] Constraint dim_credor atualizada: cnpj_historico → cnpj_nome');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('dim_credor', (t) => {
    t.dropUnique(['cnpj_cpf_norm', 'nome'], 'dim_credor_cnpj_nome_uq');
  });

  await knex.schema.alterTable('dim_credor', (t) => {
    t.unique(['cnpj_cpf_norm', 'historico_hash'], { indexName: 'dim_credor_cnpj_historico_uq' });
  });
}
