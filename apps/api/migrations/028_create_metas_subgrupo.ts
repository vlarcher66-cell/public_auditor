import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('planejamento_metas', (t) => {
    t.increments('id').primary();
    t.integer('ano').unsigned().notNullable();           // ano da meta (ex: 2026)
    t.integer('fk_subgrupo').unsigned().notNullable();   // subgrupo alvo
    t.integer('fk_municipio').unsigned().nullable();     // multitenant
    t.decimal('meta_anual', 15, 2).notNullable();        // valor meta anual
    t.decimal('percentual_ajuste', 8, 4).notNullable().defaultTo(0); // % aplicado sobre base
    t.decimal('base_calculo', 15, 2).notNullable();      // despesa real do ano anterior
    t.text('observacao').nullable();
    t.datetime('criado_em').notNullable().defaultTo(knex.fn.now());
    t.datetime('atualizado_em').notNullable().defaultTo(knex.fn.now());

    t.unique(['ano', 'fk_subgrupo', 'fk_municipio']);
    t.index(['ano']);
    t.index(['fk_municipio']);
    t.index(['fk_subgrupo']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('planejamento_metas');
}
