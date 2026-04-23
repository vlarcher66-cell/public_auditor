import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('fact_resumo_bancario', (t) => {
    t.string('fonte', 30).nullable();
    t.string('descricao', 300).nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('fact_resumo_bancario', (t) => {
    t.dropColumn('fonte');
    t.dropColumn('descricao');
  });
}
