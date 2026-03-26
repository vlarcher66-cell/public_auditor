import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('fact_ordem_pagamento', (t) => {
    t.bigIncrements('id').unsigned().primary();
    t.string('num_empenho', 30).notNullable();
    t.integer('reduzido').unsigned().notNullable().defaultTo(0);
    t.string('num_processo', 30).nullable();
    t.text('historico').nullable();
    t.integer('sub_elemento').unsigned().nullable();
    t.date('data_pagamento').notNullable();
    t.date('data_empenho').nullable();
    t.date('data_liquidacao').nullable();
    t.decimal('valor_bruto', 15, 2).notNullable().defaultTo(0);
    t.decimal('valor_retido', 15, 2).notNullable().defaultTo(0);
    t.decimal('valor_liquido', 15, 2).notNullable().defaultTo(0);
    t.decimal('valor_pessoal', 15, 2).notNullable().defaultTo(0);
    t.integer('fk_entidade').unsigned().notNullable();
    t.integer('fk_credor').unsigned().notNullable();
    t.integer('fk_tipo_empenho').unsigned().notNullable();
    t.integer('fk_periodo').unsigned().notNullable();
    t.integer('fk_unidade_orc').unsigned().notNullable();
    t.integer('fk_unidade_gestora').unsigned().notNullable();
    t.integer('fk_acao').unsigned().notNullable();
    t.integer('fk_elemento_despesa').unsigned().notNullable();
    t.integer('fk_fonte_recurso').unsigned().notNullable();
    t.integer('fk_import_job').unsigned().notNullable();
    t.string('hash_linha', 64).notNullable().unique();
    t.datetime('criado_em').notNullable().defaultTo(knex.fn.now());
    t.index(['data_pagamento']);
    t.index(['fk_credor']);
    t.index(['fk_entidade']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('fact_ordem_pagamento');
}
