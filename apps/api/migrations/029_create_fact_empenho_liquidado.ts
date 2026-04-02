import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('fact_empenho_liquidado', (t) => {
    t.increments('id').primary();
    t.integer('fk_municipio').unsigned().nullable();
    t.integer('fk_entidade').unsigned().nullable();
    t.integer('fk_import_job').unsigned().nullable();

    // Dados do empenho
    t.date('dt_liquidacao').notNullable();
    t.string('num_empenho', 50).nullable();
    t.string('num_reduzido', 50).nullable();
    t.string('classificacao_orc', 100).nullable();
    t.string('credor_nome', 255).nullable();
    t.integer('fk_credor').unsigned().nullable();     // resolvido no loader
    t.text('historico').nullable();
    t.string('tipo_empenho', 50).nullable();
    t.date('dt_empenho').nullable();
    t.string('num_processo', 100).nullable();
    t.date('dt_pagamento').nullable();                // NULL = ainda a pagar
    t.decimal('valor', 15, 2).notNullable();

    // Controle de período
    t.string('periodo_ref', 7).notNullable();         // ex: '2026-01'
    t.string('hash_linha', 64).notNullable();

    t.datetime('criado_em').notNullable().defaultTo(knex.fn.now());

    t.unique(['hash_linha']);
    t.index(['fk_municipio']);
    t.index(['fk_entidade']);
    t.index(['periodo_ref']);
    t.index(['dt_pagamento']);
    t.index(['fk_credor']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('fact_empenho_liquidado');
}
