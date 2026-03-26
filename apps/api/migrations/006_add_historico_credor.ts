import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('dim_credor', (t) => {
    t.text('historico').nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('dim_credor', (t) => {
    t.dropColumn('historico');
  });
}
