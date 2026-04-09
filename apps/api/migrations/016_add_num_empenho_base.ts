import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // 1. Adiciona num_empenho_base na tabela de fatos
  //    "23/21" → "23" | "288" → "288" | "224/1" → "224"
  await knex.schema.alterTable('fact_ordem_pagamento', (t) => {
    t.string('num_empenho_base', 20).nullable();
    t.index(['num_empenho_base']);
  });

  // 2. Popula num_empenho_base nos registros existentes
  await knex.raw(`
    UPDATE fact_ordem_pagamento
    SET num_empenho_base = TRIM(SPLIT_PART(num_empenho, '/', 1))
  `);

  // 3. Adiciona coluna num_empenhos em dim_setor (lista separada por vírgula, igual palavras_chave)
  await knex.schema.alterTable('dim_setor', (t) => {
    t.text('num_empenhos').nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('fact_ordem_pagamento', (t) => {
    t.dropColumn('num_empenho_base');
  });
  await knex.schema.alterTable('dim_setor', (t) => {
    t.dropColumn('num_empenhos');
  });
}
