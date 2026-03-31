import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // 1. Tabela de municípios
  await knex.schema.createTable('dim_municipio', (t) => {
    t.increments('id').unsigned().primary();
    t.string('nome', 255).notNullable();
    t.string('cnpj', 18).nullable();
    t.string('uf', 2).nullable();
    t.boolean('ativo').notNullable().defaultTo(true);
    t.datetime('criado_em').notNullable().defaultTo(knex.fn.now());
  });

  // 2. fk_municipio em dim_entidade
  await knex.schema.alterTable('dim_entidade', (t) => {
    t.integer('fk_municipio').unsigned().nullable().references('id').inTable('dim_municipio').onDelete('RESTRICT');
  });

  // 3. fk_municipio em dim_credor (credores são por município)
  await knex.schema.alterTable('dim_credor', (t) => {
    t.integer('fk_municipio').unsigned().nullable().references('id').inTable('dim_municipio').onDelete('RESTRICT');
  });

  // 4. fk_municipio em dim_bloco
  await knex.schema.alterTable('dim_bloco', (t) => {
    t.integer('fk_municipio').unsigned().nullable().references('id').inTable('dim_municipio').onDelete('RESTRICT');
  });

  // 5. fk_municipio em dim_grupo_despesa
  await knex.schema.alterTable('dim_grupo_despesa', (t) => {
    t.integer('fk_municipio').unsigned().nullable().references('id').inTable('dim_municipio').onDelete('RESTRICT');
  });

  // 6. fk_municipio em dim_subgrupo_despesa
  await knex.schema.alterTable('dim_subgrupo_despesa', (t) => {
    t.integer('fk_municipio').unsigned().nullable().references('id').inTable('dim_municipio').onDelete('RESTRICT');
  });

  // Nota: fact_ordem_pagamento já tem fk_entidade, que por sua vez tem fk_municipio.
  // Para performance de queries diretas, adiciona índice via fk_entidade.
  // dim_setor e dim_secretaria herdam via fk_entidade → dim_secretaria → dim_setor.
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('dim_subgrupo_despesa', (t) => t.dropColumn('fk_municipio'));
  await knex.schema.alterTable('dim_grupo_despesa', (t) => t.dropColumn('fk_municipio'));
  await knex.schema.alterTable('dim_bloco', (t) => t.dropColumn('fk_municipio'));
  await knex.schema.alterTable('dim_credor', (t) => t.dropColumn('fk_municipio'));
  await knex.schema.alterTable('dim_entidade', (t) => t.dropColumn('fk_municipio'));
  await knex.schema.dropTableIfExists('dim_municipio');
}
