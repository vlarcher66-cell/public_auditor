import type { Knex } from 'knex';
import * as bcrypt from 'bcryptjs';

export async function seed(knex: Knex): Promise<void> {
  await knex('usuarios').where({ email: 'admin@prefeitura.gov.br' }).delete();

  const senha_hash = await bcrypt.hash('Admin@2025!', 12);

  await knex('usuarios').insert({
    nome: 'Administrador',
    email: 'admin@prefeitura.gov.br',
    senha_hash,
    role: 'SUPER_ADMIN',
    ativo: true,
    fk_municipio: null,
    fk_entidade: null,
    criado_em: new Date(),
  });

  console.log('✅ Super Admin criado: admin@prefeitura.gov.br / Admin@2025!');
}
