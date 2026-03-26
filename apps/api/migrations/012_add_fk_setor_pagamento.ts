import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('fact_ordem_pagamento', (t) => {
    t.integer('fk_setor_pag').unsigned().nullable();
    t.foreign('fk_setor_pag').references('id').inTable('dim_setor').onDelete('SET NULL');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('fact_ordem_pagamento', (t) => {
    t.dropForeign(['fk_setor_pag']);
    t.dropColumn('fk_setor_pag');
  });
}
