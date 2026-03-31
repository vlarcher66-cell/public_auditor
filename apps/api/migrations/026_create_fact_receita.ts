import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('fact_receita', (t) => {
    t.bigIncrements('id').unsigned().primary();

    // Dados do lançamento
    t.date('data_receita').notNullable();
    t.string('conhecimento', 20).nullable();        // nº conhecimento
    t.string('num_empenho', 30).nullable();         // nº empenho (quando houver)
    t.string('codigo_rubrica', 60).nullable();      // código orçamentário completo
    t.text('descricao').nullable();                 // descrição da rubrica
    t.string('documento', 30).nullable();           // CNPJ/CPF do fornecedor (documento)

    // Valores
    t.decimal('valor', 15, 2).notNullable().defaultTo(0);

    // Tipo: ORC = orçamentária, EXTRA = extra orçamentária
    t.string('tipo_receita', 10).notNullable().defaultTo('ORC');

    // Fonte de recurso (ex: "1500", "1600", "1604")
    t.string('fonte_recurso', 20).nullable();

    // Período de referência (mês/ano da competência)
    t.string('periodo_referencia', 20).nullable();  // ex: "Janeiro/2026"
    t.integer('ano').unsigned().nullable();
    t.integer('mes').unsigned().nullable();

    // Fornecedor (credor da receita — quem pagou o tributo ou transferiu)
    t.string('fornecedor_nome', 200).nullable();
    t.string('fornecedor_doc', 20).nullable();       // CNPJ/CPF normalizado

    // FKs
    t.integer('fk_entidade').unsigned().notNullable();
    t.integer('fk_municipio').unsigned().nullable();
    t.integer('fk_import_job').unsigned().notNullable();

    // Deduplicação
    t.string('hash_linha', 64).notNullable().unique();

    t.datetime('criado_em').notNullable().defaultTo(knex.fn.now());

    // Índices
    t.index(['data_receita']);
    t.index(['fk_entidade']);
    t.index(['fk_municipio']);
    t.index(['fk_import_job']);
    t.index(['fonte_recurso']);
    t.index(['tipo_receita']);
    t.index(['ano', 'mes']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('fact_receita');
}
