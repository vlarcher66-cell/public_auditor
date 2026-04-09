import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('import_jobs', (t) => {
    t.string('sistema_origem', 50).nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('import_jobs', (t) => {
    t.dropColumn('sistema_origem');
  });
}
