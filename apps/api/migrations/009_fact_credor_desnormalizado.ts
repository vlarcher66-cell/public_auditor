import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('fact_ordem_pagamento', (t) => {
    t.string('credor_nome', 255).nullable();
    t.string('credor_cnpj_cpf', 20).nullable();
  });

  // Backfill com os dados atuais de dim_credor
  await knex.raw(`
    UPDATE fact_ordem_pagamento f
    JOIN dim_credor c ON f.fk_credor = c.id
    SET f.credor_nome = c.nome,
        f.credor_cnpj_cpf = c.cnpj_cpf
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('fact_ordem_pagamento', (t) => {
    t.dropColumn('credor_nome');
    t.dropColumn('credor_cnpj_cpf');
  });
}
