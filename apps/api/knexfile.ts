import type { Knex } from 'knex';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const config: { [key: string]: Knex.Config } = {
  development: {
    client: 'mysql2',
    connection: {
      host: process.env.DATABASE_HOST || '127.0.0.1',
      port: Number(process.env.DATABASE_PORT) || 3306,
      database: process.env.DATABASE_NAME || 'public_auditor',
      user: process.env.DATABASE_USER || 'root',
      password: process.env.DATABASE_PASSWORD || '',
      charset: 'utf8mb4',
    },
    pool: { min: 2, max: 10 },
    migrations: { directory: './migrations', extension: 'ts' },
    seeds: { directory: './seeds', extension: 'ts' },
  },
};

module.exports = config;
export default config;
