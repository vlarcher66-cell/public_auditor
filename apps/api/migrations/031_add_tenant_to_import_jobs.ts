import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('import_jobs', (t) => {
    t.integer('fk_entidade').unsigned().nullable();
    t.integer('fk_municipio').unsigned().nullable();
    t.index(['fk_entidade']);
    t.index(['fk_municipio']);
  });

  // Backfill: preenche fk_municipio e fk_entidade a partir dos fatos já importados
  await knex.raw(`
    UPDATE import_jobs j
    SET fk_entidade = f.fk_entidade,
        fk_municipio = e.fk_municipio
    FROM fact_ordem_pagamento f
    JOIN dim_entidade e ON f.fk_entidade = e.id
    WHERE f.fk_import_job = j.id AND j.fk_entidade IS NULL
  `).catch(() => {});

  await knex.raw(`
    UPDATE import_jobs j
    SET fk_entidade = f.fk_entidade,
        fk_municipio = e.fk_municipio
    FROM fact_receita f
    JOIN dim_entidade e ON f.fk_entidade = e.id
    WHERE f.fk_import_job = j.id AND j.fk_entidade IS NULL
  `).catch(() => {});
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('import_jobs', (t) => {
    t.dropIndex(['fk_entidade']);
    t.dropIndex(['fk_municipio']);
    t.dropColumn('fk_entidade');
    t.dropColumn('fk_municipio');
  });
}
