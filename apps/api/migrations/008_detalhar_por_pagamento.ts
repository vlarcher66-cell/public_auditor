import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('dim_credor', (t) => {
    t.boolean('detalhar_no_pagamento').notNullable().defaultTo(false);
  });

  await knex.schema.alterTable('fact_ordem_pagamento', (t) => {
    t.integer('fk_grupo_pag').unsigned().nullable();
    t.integer('fk_subgrupo_pag').unsigned().nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('fact_ordem_pagamento', (t) => {
    t.dropColumn('fk_grupo_pag');
    t.dropColumn('fk_subgrupo_pag');
  });
  await knex.schema.alterTable('dim_credor', (t) => {
    t.dropColumn('detalhar_no_pagamento');
  });
}
