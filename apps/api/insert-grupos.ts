import knex from 'knex';
import dotenv from 'dotenv';

dotenv.config({ path: '../../.env' });

const db = knex({
  client: 'pg',
  connection: {
    host: process.env.DATABASE_HOST,
    port: parseInt(process.env.DATABASE_PORT || '5432'),
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
  },
});

async function insertGrupos() {
  try {
    console.log('Iniciando inserção de grupos...');

    // Limpar tabela antes de inserir
    await db('dim_grupo_despesa').delete();

    // Inserir grupos
    await db('dim_grupo_despesa').insert([
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

    console.log('✅ 18 grupos inseridos com sucesso!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro ao inserir grupos:', error);
    process.exit(1);
  }
}

insertGrupos();
