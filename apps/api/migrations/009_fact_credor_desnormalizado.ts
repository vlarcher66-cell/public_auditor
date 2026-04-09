import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('fact_ordem_pagamento', (t) => {
    t.string('credor_nome', 255).nullable();
    t.string('credor_cnpj_cpf', 20).nullable();
  });

  // Backfill com os dados atuais de dim_credor
  await knex.raw(`
    UPDATE fact_ordem_pagamento f
    SET credor_nome = c.nome,
        credor_cnpj_cpf = c.cnpj_cpf
    FROM dim_credor c
    WHERE f.fk_credor = c.id
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('fact_ordem_pagamento', (t) => {
    t.dropColumn('credor_nome');
    t.dropColumn('credor_cnpj_cpf');
  });
}
