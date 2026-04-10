import type { Knex } from 'knex';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const isProduction = process.env.NODE_ENV === 'production';

const connectionConfig = isProduction && process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
  : {
      host: process.env.DATABASE_HOST || '127.0.0.1',
      port: Number(process.env.DATABASE_PORT) || 5432,
      database: process.env.DATABASE_NAME || 'public_auditor',
      user: process.env.DATABASE_USER || 'postgres',
      password: process.env.DATABASE_PASSWORD || '',
    };

const config: { [key: string]: Knex.Config } = {
  development: {
    client: 'pg',
    connection: process.env.DATABASE_URL
      ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
      : {
          host: process.env.DATABASE_HOST || '127.0.0.1',
          port: Number(process.env.DATABASE_PORT) || 5432,
          database: process.env.DATABASE_NAME || 'public_auditor',
          user: process.env.DATABASE_USER || 'postgres',
          password: process.env.DATABASE_PASSWORD || '',
        },
    pool: { min: 2, max: 10 },
    migrations: { directory: './migrations', extension: 'ts' },
    seeds: { directory: './seeds', extension: 'ts' },
  },
  production: {
    client: 'pg',
    connection: connectionConfig,
    pool: { min: 2, max: 10 },
    migrations: { directory: path.resolve(__dirname, 'migrations'), extension: 'js' },
    seeds: { directory: path.resolve(__dirname, 'seeds'), extension: 'js' },
  },
};

module.exports = config;
export default config;
