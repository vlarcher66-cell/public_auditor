import type { Knex } from 'knex';
import { createHash } from 'crypto';

export async function up(knex: Knex): Promise<void> {
  // Drop the old unique constraint on cnpj_cpf_norm alone
  await knex.schema.table('dim_credor', (t) => {
    t.dropUnique(['cnpj_cpf_norm']);
    t.string('historico_hash', 32).notNullable().defaultTo('');
    t.boolean('precisa_reclassificacao').notNullable().defaultTo(false);
  });

  // Backfill historico_hash for existing rows
  const rows = await knex('dim_credor').select('id', 'historico');
  for (const row of rows) {
    const hash = row.historico?.trim()
      ? createHash('md5').update(row.historico.trim()).digest('hex')
      : '';
    await knex('dim_credor').where('id', row.id).update({ historico_hash: hash });
  }

  // New unique constraint: one entry per (cnpj+historico) combination
  await knex.schema.table('dim_credor', (t) => {
    t.unique(['cnpj_cpf_norm', 'historico_hash'], { indexName: 'dim_credor_cnpj_historico_uq' });
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.table('dim_credor', (t) => {
    t.dropUnique(['cnpj_cpf_norm', 'historico_hash'], 'dim_credor_cnpj_historico_uq');
    t.dropColumn('historico_hash');
    t.dropColumn('precisa_reclassificacao');
    t.unique(['cnpj_cpf_norm']);
  });
}
