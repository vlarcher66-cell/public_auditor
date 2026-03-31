import type { Knex } from 'knex';

/**
 * Converte todos os usuários com role='ADMIN' para 'SUPER_ADMIN'.
 * Necessário para compatibilidade com o novo sistema multi-tenant.
 */
export async function up(knex: Knex): Promise<void> {
  const updated = await knex('usuarios').where({ role: 'ADMIN' }).update({ role: 'SUPER_ADMIN' });
  if (updated > 0) {
    console.log(`✅ ${updated} usuário(s) migrado(s) de ADMIN → SUPER_ADMIN`);
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex('usuarios').where({ role: 'SUPER_ADMIN' }).update({ role: 'ADMIN' });
}
