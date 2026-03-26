import * as dotenv from 'dotenv';
import * as path from 'path';
import { z } from 'zod';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_PORT: z.coerce.number().default(3001),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  DATABASE_HOST: z.string().default('127.0.0.1'),
  DATABASE_PORT: z.coerce.number().default(3306),
  DATABASE_NAME: z.string().default('public_auditor'),
  DATABASE_USER: z.string().default('root'),
  DATABASE_PASSWORD: z.string().default(''),
  JWT_SECRET: z.string().default('gestor_publico_jwt_secret_32chars_minimo_2025!!'),
  JWT_EXPIRES_IN: z.string().default('8h'),
  UPLOAD_DIR: z.string().default('./uploads'),
  MAX_FILE_SIZE_MB: z.coerce.number().default(50),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Env inválido:', parsed.error.format());
  process.exit(1);
}
export const env = parsed.data;
