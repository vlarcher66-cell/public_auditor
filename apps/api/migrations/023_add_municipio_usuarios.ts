import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('usuarios', (t) => {
    t.integer('fk_municipio').unsigned().nullable().references('id').inTable('dim_municipio').onDelete('RESTRICT');
    // fk_entidade opcional — restringe acesso a uma entidade específica dentro do município
    t.integer('fk_entidade').unsigned().nullable().references('id').inTable('dim_entidade').onDelete('SET NULL');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('usuarios', (t) => {
    t.dropColumn('fk_entidade');
    t.dropColumn('fk_municipio');
  });
}
