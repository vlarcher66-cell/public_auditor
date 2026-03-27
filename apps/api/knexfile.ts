import type { Knex } from 'knex';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const isProduction = process.env.NODE_ENV === 'production';

const connectionConfig = isProduction && process.env.MYSQL_URL
  ? {
      connectionString: process.env.MYSQL_URL,
      ssl: { rejectUnauthorized: false },
    }
  : {
      host: process.env.DATABASE_HOST || '127.0.0.1',
      port: Number(process.env.DATABASE_PORT) || 3306,
      database: process.env.DATABASE_NAME || 'public_auditor',
      user: process.env.DATABASE_USER || 'root',
      password: process.env.DATABASE_PASSWORD || '',
      charset: 'utf8mb4',
    };

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
  production: {
    client: 'mysql2',
    connection: connectionConfig,
    pool: { min: 2, max: 10 },
    migrations: { directory: './dist/migrations', extension: 'js' },
    seeds: { directory: './dist/seeds', extension: 'js' },
  },
};

module.exports = config;
export default config;
