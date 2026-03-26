import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('dim_setor', (t) => {
    t.text('palavras_chave').nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('dim_setor', (t) => {
    t.dropColumn('palavras_chave');
  });
}
