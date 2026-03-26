import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('usuarios', (t) => {
    t.increments('id').unsigned().primary();
    t.string('nome', 255).notNullable();
    t.string('email', 255).notNullable().unique();
    t.string('senha_hash', 255).notNullable();
    t.string('role', 20).notNullable().defaultTo('VIEWER');
    t.boolean('ativo').notNullable().defaultTo(true);
    t.datetime('ultimo_acesso').nullable();
    t.datetime('criado_em').notNullable().defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('usuarios');
}
