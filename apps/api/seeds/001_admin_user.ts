import type { Knex } from 'knex';
import * as bcrypt from 'bcryptjs';

export async function seed(knex: Knex): Promise<void> {
  // Remove existing admin
  await knex('usuarios').where({ email: 'admin@prefeitura.gov.br' }).delete();

  const senha_hash = await bcrypt.hash('Admin@2025!', 12);

  await knex('usuarios').insert({
    nome: 'Administrador',
    email: 'admin@prefeitura.gov.br',
    senha_hash,
    role: 'ADMIN',
    ativo: true,
    criado_em: new Date(),
  });

  console.log('✅ Admin criado: admin@prefeitura.gov.br / Admin@2025!');
}
