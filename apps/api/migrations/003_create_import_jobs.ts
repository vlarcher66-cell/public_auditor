import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('import_jobs', (t) => {
    t.increments('id').unsigned().primary();
    t.uuid('uuid').notNullable().unique();
    t.string('filename', 255).notNullable();
    t.string('file_type', 10).notNullable();
    t.integer('file_size_bytes').unsigned().nullable();
    t.string('status', 20).notNullable().defaultTo('QUEUED');
    t.integer('total_rows').unsigned().defaultTo(0);
    t.integer('rows_loaded').unsigned().defaultTo(0);
    t.integer('rows_skipped').unsigned().defaultTo(0);
    t.integer('rows_errored').unsigned().defaultTo(0);
    t.json('error_log').nullable();
    t.datetime('started_at').nullable();
    t.datetime('finished_at').nullable();
    t.integer('fk_usuario').unsigned().notNullable();
    t.datetime('criado_em').notNullable().defaultTo(knex.fn.now());
    t.foreign('fk_usuario').references('id').inTable('usuarios');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('import_jobs');
}
