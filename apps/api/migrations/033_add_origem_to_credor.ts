import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('dim_credor', (t) => {
    t.enum('origem', ['PAGO', 'A_PAGAR']).nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('dim_credor', (t) => {
    t.dropColumn('origem');
  });
}
