import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('dim_entidade', (t) => {
    t.increments('id').unsigned().primary();
    t.string('nome', 255).notNullable();
    t.string('cnpj', 18).notNullable().unique();
    t.string('tipo', 20).notNullable().defaultTo('FUNDO');
    t.boolean('ativo').notNullable().defaultTo(true);
    t.datetime('criado_em').notNullable().defaultTo(knex.fn.now());
  });
  await knex.schema.createTable('dim_credor', (t) => {
    t.increments('id').unsigned().primary();
    t.string('nome', 255).notNullable();
    t.string('cnpj_cpf', 18).notNullable();
    t.string('tipo_doc', 10).notNullable().defaultTo('CNPJ');
    t.string('cnpj_cpf_norm', 14).notNullable().unique();
  });
  await knex.schema.createTable('dim_unidade_orcamentaria', (t) => {
    t.increments('id').unsigned().primary();
    t.integer('codigo').unsigned().notNullable().unique();
    t.string('descricao', 255).nullable();
  });
  await knex.schema.createTable('dim_unidade_gestora', (t) => {
    t.increments('id').unsigned().primary();
    t.integer('codigo').unsigned().notNullable().unique();
    t.string('descricao', 255).nullable();
  });
  await knex.schema.createTable('dim_acao', (t) => {
    t.increments('id').unsigned().primary();
    t.string('codigo', 20).notNullable().unique();
    t.string('descricao', 255).nullable();
  });
  await knex.schema.createTable('dim_elemento_despesa', (t) => {
    t.increments('id').unsigned().primary();
    t.string('codigo', 20).notNullable().unique();
    t.string('descricao', 255).nullable();
  });
  await knex.schema.createTable('dim_fonte_recurso', (t) => {
    t.increments('id').unsigned().primary();
    t.string('codigo', 20).notNullable().unique();
    t.string('descricao', 255).nullable();
  });
  await knex.schema.createTable('dim_tipo_empenho', (t) => {
    t.increments('id').unsigned().primary();
    t.string('descricao', 50).notNullable().unique();
  });
  await knex.schema.createTable('dim_periodo', (t) => {
    t.increments('id').unsigned().primary();
    t.date('data_inicio').notNullable();
    t.date('data_fim').notNullable();
    t.integer('ano').unsigned().nullable();
    t.integer('mes').unsigned().nullable();
    t.unique(['data_inicio', 'data_fim']);
  });
}

export async function down(knex: Knex): Promise<void> {
  for (const t of ['dim_periodo','dim_tipo_empenho','dim_fonte_recurso','dim_elemento_despesa','dim_acao','dim_unidade_gestora','dim_unidade_orcamentaria','dim_credor','dim_entidade']) {
    await knex.schema.dropTableIfExists(t);
  }
}
