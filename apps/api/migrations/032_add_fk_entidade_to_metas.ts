import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasCol = await knex.schema.hasColumn('planejamento_metas', 'fk_entidade');
  if (!hasCol) {
    await knex.schema.alterTable('planejamento_metas', (t) => {
      t.integer('fk_entidade').unsigned().nullable().after('fk_municipio');
      t.index(['fk_entidade'], 'idx_metas_fk_entidade');
    });
  }

  // Dropa o unique antigo (se ainda existir) e recria com nome curto incluindo fk_entidade
  const [rows]: any = await knex.raw(`
    SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS
    WHERE TABLE_NAME = 'planejamento_metas'
      AND CONSTRAINT_TYPE = 'UNIQUE'
      AND CONSTRAINT_NAME = 'planejamento_metas_ano_fk_subgrupo_fk_municipio_unique'
      AND TABLE_SCHEMA = DATABASE()
  `);
  if (rows.length > 0) {
    await knex.raw(`ALTER TABLE planejamento_metas DROP INDEX planejamento_metas_ano_fk_subgrupo_fk_municipio_unique`);
  }

  const [rows2]: any = await knex.raw(`
    SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS
    WHERE TABLE_NAME = 'planejamento_metas'
      AND CONSTRAINT_TYPE = 'UNIQUE'
      AND CONSTRAINT_NAME = 'uq_metas_ano_sub_mun_ent'
      AND TABLE_SCHEMA = DATABASE()
  `);
  if (rows2.length === 0) {
    await knex.raw(`
      ALTER TABLE planejamento_metas
      ADD UNIQUE KEY uq_metas_ano_sub_mun_ent (ano, fk_subgrupo, fk_municipio, fk_entidade)
    `);
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`ALTER TABLE planejamento_metas DROP INDEX uq_metas_ano_sub_mun_ent`);

  await knex.schema.alterTable('planejamento_metas', (t) => {
    t.unique(['ano', 'fk_subgrupo', 'fk_municipio']);
    t.dropIndex([], 'idx_metas_fk_entidade');
    t.dropColumn('fk_entidade');
  });
}
