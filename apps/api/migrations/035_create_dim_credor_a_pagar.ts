import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Nova tabela: credores que vêm exclusivamente de importações de empenhos liquidados
  await knex.schema.createTable('dim_credor_a_pagar', (t) => {
    t.increments('id').primary();
    t.string('nome', 255).notNullable();
    t.integer('fk_municipio').unsigned().nullable();
    t.integer('fk_grupo').unsigned().nullable();
    t.integer('fk_subgrupo').unsigned().nullable();
    t.text('historico').nullable();
    t.datetime('criado_em').notNullable().defaultTo(knex.fn.now());

    t.foreign('fk_grupo').references('id').inTable('dim_grupo_despesa').onDelete('SET NULL');
    t.foreign('fk_subgrupo').references('id').inTable('dim_subgrupo_despesa').onDelete('SET NULL');

    t.index(['fk_municipio']);
    t.index(['fk_grupo']);
  });

  // Adiciona coluna em fact_empenho_liquidado apontando para dim_credor_a_pagar
  await knex.schema.alterTable('fact_empenho_liquidado', (t) => {
    t.integer('fk_credor_a_pagar').unsigned().nullable();
    t.foreign('fk_credor_a_pagar').references('id').inTable('dim_credor_a_pagar').onDelete('SET NULL');
    t.index(['fk_credor_a_pagar']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('fact_empenho_liquidado', (t) => {
    t.dropForeign(['fk_credor_a_pagar']);
    t.dropIndex(['fk_credor_a_pagar']);
    t.dropColumn('fk_credor_a_pagar');
  });
  await knex.schema.dropTableIfExists('dim_credor_a_pagar');
}
