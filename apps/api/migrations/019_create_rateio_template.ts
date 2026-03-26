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

  // Adiciona índice único com nome curto (seguro para MySQL)
  await knex.raw(`
    ALTER TABLE dim_rateio_template
    ADD UNIQUE INDEX uq_rateio_tpl (fk_credor, num_empenho_base, fk_setor, fk_grupo, fk_subgrupo)
  `).catch(() => { /* índice já existe */ });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('dim_rateio_template');
}
