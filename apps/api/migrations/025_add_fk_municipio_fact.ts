import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // 1. Adiciona coluna desnormalizada na fact table
  await knex.schema.alterTable('fact_ordem_pagamento', (t) => {
    t.integer('fk_municipio').unsigned().nullable()
      .references('id').inTable('dim_municipio').onDelete('RESTRICT');
    t.index('fk_municipio');
  });

  // 2. Backfill: preenche fk_municipio a partir da dim_entidade
  await knex.raw(`
    UPDATE fact_ordem_pagamento f
    SET fk_municipio = e.fk_municipio
    FROM dim_entidade e
    WHERE f.fk_entidade = e.id AND e.fk_municipio IS NOT NULL
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('fact_ordem_pagamento', (t) => {
    t.dropIndex('fk_municipio');
    t.dropColumn('fk_municipio');
  });
}
