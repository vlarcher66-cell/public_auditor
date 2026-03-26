import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('dim_grupo_despesa', (t) => {
    t.increments('id').unsigned().primary();
    t.string('nome', 100).notNullable().unique();
    t.string('descricao', 255).nullable();
    t.datetime('criado_em').notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('dim_subgrupo_despesa', (t) => {
    t.increments('id').unsigned().primary();
    t.string('nome', 100).notNullable();
    t.integer('fk_grupo').unsigned().notNullable();
    t.foreign('fk_grupo').references('id').inTable('dim_grupo_despesa').onDelete('CASCADE');
    t.unique(['nome', 'fk_grupo']);
    t.datetime('criado_em').notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.alterTable('dim_credor', (t) => {
    t.integer('fk_grupo').unsigned().nullable();
    t.integer('fk_subgrupo').unsigned().nullable();
    t.foreign('fk_grupo').references('id').inTable('dim_grupo_despesa').onDelete('SET NULL');
    t.foreign('fk_subgrupo').references('id').inTable('dim_subgrupo_despesa').onDelete('SET NULL');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('dim_credor', (t) => {
    t.dropForeign(['fk_grupo']);
    t.dropForeign(['fk_subgrupo']);
    t.dropColumn('fk_grupo');
    t.dropColumn('fk_subgrupo');
  });
  await knex.schema.dropTableIfExists('dim_subgrupo_despesa');
  await knex.schema.dropTableIfExists('dim_grupo_despesa');
}
