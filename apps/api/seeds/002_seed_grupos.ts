import type { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
  await knex('dim_grupo').delete();

  await knex('dim_grupo').insert([
    { nome: 'DESPESA COM PESSOAL' },
    { nome: 'DESPESA COM DIÁRIAS' },
    { nome: 'DESPESA COM ALUGUEL' },
    { nome: 'DESPESA COM VEÍCULO' },
    { nome: 'COOPERATIVA DE SAÚDE - MÉDICOS' },
    { nome: 'COOPERATIVA DE SAÚDE - OUTROS' },
    { nome: 'PROCEDIMENTOS NA ATENÇÃO À SAÚDE' },
    { nome: 'COOPERATIVA A CONCILIAR' },
    { nome: 'MATERIAL DE CONSUMO' },
    { nome: 'MANUTENÇÃO E REPAROS' },
    { nome: 'DESPESAS FINANCEIRAS' },
    { nome: 'DESPESA COM SERV. PESSOA JURÍDICA' },
    { nome: 'DESPESAS DIVERSAS' },
    { nome: 'UTILIDADES' },
    { nome: 'INVESTIMENTOS' },
    { nome: 'RESTOS A PAGAR' },
    { nome: 'DESPESAS DO EXERCÍCIO ANTERIOR' },
    { nome: 'DESPESAS EXTRA - ORÇAMENTÁRIA' },
  ]);
}
