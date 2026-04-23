import type { Knex } from 'knex';

const tables = [
  'dim_periodo',
  'dim_tipo_empenho',
  'dim_fonte_recurso',
  'dim_elemento_despesa',
  'dim_acao',
  'dim_unidade_gestora',
  'dim_unidade_orcamentaria',
  'dim_credor',
  'dim_entidade',
];

export async function up(knex: Knex): Promise<void> {
  for (const table of tables) {
    await knex.raw(`
      SELECT setval(
        pg_get_serial_sequence('${table}', 'id'),
        COALESCE((SELECT MAX(id) FROM ${table}), 0) + 1,
        false
      )
    `);
  }
}

export async function down(_knex: Knex): Promise<void> {
  // não há rollback para reset de sequence
}
