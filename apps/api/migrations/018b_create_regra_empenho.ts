import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('dim_regra_empenho', (t) => {
    t.increments('id');
    t.string('num_empenho_base', 20).notNullable();
    t.integer('fk_credor').unsigned().notNullable().references('id').inTable('dim_credor').onDelete('CASCADE');
    t.integer('fk_grupo').unsigned().nullable().references('id').inTable('dim_grupo_despesa');
    t.integer('fk_subgrupo').unsigned().nullable().references('id').inTable('dim_subgrupo_despesa');
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.unique(['num_empenho_base', 'fk_credor']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('dim_regra_empenho');
}
