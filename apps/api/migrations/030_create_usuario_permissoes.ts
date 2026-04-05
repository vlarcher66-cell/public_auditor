import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Tabela de permissões de menu/submenu por usuário
  await knex.schema.createTable('usuario_permissoes', (t) => {
    t.increments('id').unsigned().primary();
    t.integer('fk_usuario').unsigned().notNullable()
      .references('id').inTable('usuarios').onDelete('CASCADE');
    t.string('permissao', 100).notNullable(); // ex: 'menu.despesa', 'analise.despesa'
    t.unique(['fk_usuario', 'permissao']);
  });

  // Tabela de entidades acessíveis por usuário
  await knex.schema.createTable('usuario_entidades', (t) => {
    t.increments('id').unsigned().primary();
    t.integer('fk_usuario').unsigned().notNullable()
      .references('id').inTable('usuarios').onDelete('CASCADE');
    t.integer('fk_entidade').unsigned().notNullable()
      .references('id').inTable('dim_entidade').onDelete('CASCADE');
    t.unique(['fk_usuario', 'fk_entidade']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('usuario_entidades');
  await knex.schema.dropTableIfExists('usuario_permissoes');
}
