import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('fact_resumo_bancario', (t) => {
    t.bigIncrements('id').unsigned().primary();

    // Conta bancária
    t.string('num_ordem', 30).nullable();          // Nº de Ordem
    t.string('nome_conta', 300).nullable();         // Nome da conta/histórico

    // Valores
    t.decimal('saldo_anterior', 15, 2).nullable();
    t.decimal('creditos', 15, 2).nullable();
    t.decimal('debitos', 15, 2).nullable();
    t.decimal('saldo_atual', 15, 2).nullable();

    // Período
    t.string('periodo_ref', 20).notNullable();      // ex: "2026-01"
    t.integer('ano').unsigned().nullable();
    t.integer('mes').unsigned().nullable();

    // Multi-tenant
    t.integer('fk_entidade').unsigned().notNullable();
    t.integer('fk_municipio').unsigned().nullable();
    t.integer('fk_import_job').unsigned().notNullable();

    // Deduplicação
    t.string('hash_linha', 64).notNullable().unique();

    t.datetime('criado_em').notNullable().defaultTo(knex.fn.now());

    t.index(['periodo_ref']);
    t.index(['fk_entidade']);
    t.index(['fk_municipio']);
    t.index(['fk_import_job']);
    t.index(['ano', 'mes']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('fact_resumo_bancario');
}
