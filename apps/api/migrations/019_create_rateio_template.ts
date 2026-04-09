import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const exists = await knex.schema.hasTable('dim_rateio_template');
  if (!exists) {
    await knex.schema.createTable('dim_rateio_template', (t) => {
      t.increments('id').primary();
      t.integer('fk_credor').unsigned().notNullable();
      t.string('num_empenho_base', 50).notNullable();
      t.integer('fk_setor').unsigned().nullable();
      t.integer('fk_grupo').unsigned().nullable();
      t.integer('fk_subgrupo').unsigned().nullable();
      t.integer('ordem').unsigned().notNullable().defaultTo(0);
      t.timestamp('criado_em').defaultTo(knex.fn.now());
    });
  }

  await knex.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_rateio_tpl
    ON dim_rateio_template (fk_credor, num_empenho_base, COALESCE(fk_setor, -1), COALESCE(fk_grupo, -1), COALESCE(fk_subgrupo, -1))
  `).catch(() => { /* índice já existe */ });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('dim_rateio_template');
}
