import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('fact_ordem_pagamento', (t) => {
    t.json('rateio_itens').nullable().comment('Array de {fk_grupo, fk_subgrupo, valor}');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('fact_ordem_pagamento', (t) => {
    t.dropColumn('rateio_itens');
  });
}
