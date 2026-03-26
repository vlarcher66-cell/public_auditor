import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('dim_bloco', (t) => {
    t.increments('id').primary();
    t.string('descricao', 255).notNullable();
    t.timestamp('criado_em').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('dim_setor', (t) => {
    t.increments('id').primary();
    t.string('descricao', 255).notNullable();
    t.integer('fk_bloco').unsigned().notNullable().references('id').inTable('dim_bloco');
    t.timestamp('criado_em').defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('dim_setor');
  await knex.schema.dropTable('dim_bloco');
}
