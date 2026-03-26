import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('import_jobs', (t) => {
    // OR = Orçamentário, RP = Restos a Pagar
    t.string('tipo_relatorio', 3).notNullable().defaultTo('OR');
    t.decimal('valor_bruto_total', 15, 2).notNullable().defaultTo(0);
  });

  await knex.schema.alterTable('fact_ordem_pagamento', (t) => {
    // OR = Orçamentário, RP = Restos a Pagar, DEA = Despesa do Exercício Anterior
    t.string('tipo_relatorio', 3).notNullable().defaultTo('OR');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('fact_ordem_pagamento', (t) => {
    t.dropColumn('tipo_relatorio');
  });
  await knex.schema.alterTable('import_jobs', (t) => {
    t.dropColumn('tipo_relatorio');
    t.dropColumn('valor_bruto_total');
  });
}
