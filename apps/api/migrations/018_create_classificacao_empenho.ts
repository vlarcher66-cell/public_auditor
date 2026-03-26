import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('dim_classificacao_empenho', (t) => {
    t.increments('id').primary();
    t.integer('fk_credor').unsigned().notNullable().references('id').inTable('dim_credor').onDelete('CASCADE');
    t.string('num_empenho_base', 30).notNullable();
    t.integer('fk_grupo_pag').unsigned().nullable().references('id').inTable('dim_grupo_despesa').onDelete('SET NULL');
    t.integer('fk_subgrupo_pag').unsigned().nullable().references('id').inTable('dim_subgrupo_despesa').onDelete('SET NULL');
    t.timestamp('criado_em').defaultTo(knex.fn.now());
    t.unique(['fk_credor', 'num_empenho_base']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('dim_classificacao_empenho');
}
