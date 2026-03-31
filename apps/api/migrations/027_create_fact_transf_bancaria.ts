import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('fact_transf_bancaria', (t) => {
    t.bigIncrements('id').unsigned().primary();

    // Dados do lançamento
    t.date('data_transf').notNullable();

    // Conta de crédito (origem)
    t.integer('orgao_origem').unsigned().nullable();
    t.string('conta_origem_codigo', 30).nullable();   // ex: "22039-6"
    t.string('conta_origem_nome', 200).nullable();    // ex: "ICMS"
    t.string('fonte_origem', 20).nullable();          // ex: "15000000"

    // Conta de débito (destino)
    t.integer('orgao_destino').unsigned().nullable();
    t.string('conta_destino_codigo', 30).nullable();  // ex: "31766-7"
    t.string('conta_destino_nome', 200).nullable();   // ex: "FUS."
    t.string('fonte_destino', 20).nullable();         // ex: "15001002"

    // Documento
    t.string('num_documento', 30).nullable();         // ex: "060125"
    t.string('tipo_documento', 20).nullable();        // ex: "DOC", "TED"

    // Valor
    t.decimal('valor', 15, 2).notNullable().defaultTo(0);

    // Histórico / descrição
    t.text('historico').nullable();                   // ex: "REPASSE SAUDE COTA DARF."

    // Tipo de lançamento (sempre TRANSFERÊNCIA FINANCEIRA RECEBIDA neste relatório)
    t.string('tipo_lancamento', 100).nullable();

    // Período de referência (mês/ano da competência)
    t.string('periodo_referencia', 20).nullable();    // ex: "Janeiro/2026"
    t.integer('ano').unsigned().nullable();
    t.integer('mes').unsigned().nullable();

    // FKs
    t.integer('fk_entidade').unsigned().notNullable();
    t.integer('fk_municipio').unsigned().nullable();
    t.integer('fk_import_job').unsigned().notNullable();

    // Deduplicação
    t.string('hash_linha', 64).notNullable().unique();

    t.datetime('criado_em').notNullable().defaultTo(knex.fn.now());

    // Índices
    t.index(['data_transf']);
    t.index(['fk_entidade']);
    t.index(['fk_municipio']);
    t.index(['fk_import_job']);
    t.index(['fonte_destino']);
    t.index(['ano', 'mes']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('fact_transf_bancaria');
}
