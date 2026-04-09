import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('dim_entidade', (t) => {
    t.enum('sistema_contabil', ['FATOR', 'SIAFIC', 'BETHA', 'OUTRO']).nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('dim_entidade', (t) => {
    t.dropColumn('sistema_contabil');
  });
}
