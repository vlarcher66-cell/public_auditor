import Knex from 'knex';
import { env } from './env';

export const db = Knex({
  client: 'pg',
  connection: {
    host: env.DATABASE_HOST,
    port: env.DATABASE_PORT,
    database: env.DATABASE_NAME,
    user: env.DATABASE_USER,
    password: env.DATABASE_PASSWORD,
    ssl: env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  },
  pool: { min: 2, max: 10 },
});
