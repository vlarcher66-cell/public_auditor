import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasCol = await knex.schema.hasColumn('planejamento_metas', 'fk_entidade');
  if (!hasCol) {
    await knex.schema.alterTable('planejamento_metas', (t) => {
      t.integer('fk_entidade').unsigned().nullable();
      t.index(['fk_entidade'], 'idx_metas_fk_entidade');
    });
  }

  // Dropa o unique antigo (se ainda existir) e recria com nome curto incluindo fk_entidade
  const rows: any = await knex.raw(`
    SELECT constraint_name FROM information_schema.table_constraints
    WHERE table_name = 'planejamento_metas'
      AND constraint_type = 'UNIQUE'
      AND constraint_name = 'planejamento_metas_ano_fk_subgrupo_fk_municipio_unique'
      AND table_schema = current_schema()
  `);
  if (rows.rows.length > 0) {
    await knex.raw(`ALTER TABLE planejamento_metas DROP CONSTRAINT planejamento_metas_ano_fk_subgrupo_fk_municipio_unique`);
  }

  const rows2: any = await knex.raw(`
    SELECT constraint_name FROM information_schema.table_constraints
    WHERE table_name = 'planejamento_metas'
      AND constraint_type = 'UNIQUE'
      AND constraint_name = 'uq_metas_ano_sub_mun_ent'
      AND table_schema = current_schema()
  `);
  if (rows2.rows.length === 0) {
    await knex.raw(`
      ALTER TABLE planejamento_metas
      ADD CONSTRAINT uq_metas_ano_sub_mun_ent UNIQUE (ano, fk_subgrupo, fk_municipio, fk_entidade)
    `);
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`ALTER TABLE planejamento_metas DROP CONSTRAINT IF EXISTS uq_metas_ano_sub_mun_ent`);

  await knex.schema.alterTable('planejamento_metas', (t) => {
    t.unique(['ano', 'fk_subgrupo', 'fk_municipio']);
    t.dropIndex([], 'idx_metas_fk_entidade');
    t.dropColumn('fk_entidade');
  });
}
