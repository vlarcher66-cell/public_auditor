import Knex from 'knex';
import { env } from './env';

export const db = Knex({
  client: 'mysql2',
  connection: {
    host: env.DATABASE_HOST,
    port: env.DATABASE_PORT,
    database: env.DATABASE_NAME,
    user: env.DATABASE_USER,
    password: env.DATABASE_PASSWORD,
    charset: 'utf8mb4',
  },
  pool: { min: 2, max: 10 },
});
