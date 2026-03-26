import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('dim_secretaria', (t) => {
    t.increments('id').unsigned().primary();
    t.string('nome', 255).notNullable();
    t.string('sigla', 20).nullable();
    t.integer('fk_entidade').unsigned().notNullable()
      .references('id').inTable('dim_entidade').onDelete('RESTRICT');
    t.boolean('ativo').notNullable().defaultTo(true);
    t.timestamp('criado_em').defaultTo(knex.fn.now());
  });

  await knex.schema.alterTable('dim_setor', (t) => {
    t.integer('fk_secretaria').unsigned().nullable()
      .references('id').inTable('dim_secretaria').onDelete('SET NULL');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('dim_setor', (t) => {
    t.dropColumn('fk_secretaria');
  });
  await knex.schema.dropTableIfExists('dim_secretaria');
}
