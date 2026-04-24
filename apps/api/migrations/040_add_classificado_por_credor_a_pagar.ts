import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('dim_credor_a_pagar', table => {
    table.integer('classificado_por').nullable().references('id').inTable('usuarios');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('dim_credor_a_pagar', table => {
    table.dropColumn('classificado_por');
  });
}
