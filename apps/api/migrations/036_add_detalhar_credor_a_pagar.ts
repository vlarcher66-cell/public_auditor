import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('dim_credor_a_pagar', (t) => {
    t.boolean('detalhar_no_pagamento').notNullable().defaultTo(false);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('dim_credor_a_pagar', (t) => {
    t.dropColumn('detalhar_no_pagamento');
  });
}
