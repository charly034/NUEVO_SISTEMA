import 'dotenv/config';

const isProduction = process.env.NODE_ENV === 'production';
const APP_TIMEZONE = process.env.APP_TIMEZONE || 'America/Argentina/Buenos_Aires';
process.env.TZ = APP_TIMEZONE;

const parsePositiveInteger = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

if (isProduction && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET es obligatorio en producción');
}

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3000', 10),

  DB_HOST: process.env.DB_HOST || 'localhost',
  DB_PORT: parseInt(process.env.DB_PORT || '5432', 10),
  DB_NAME: process.env.DB_NAME || 'app_db',
  DB_USER: process.env.DB_USER || 'app_user',
  DB_PASSWORD: process.env.DB_PASSWORD || 'app_password',
  DB_SSL: process.env.DB_SSL === 'true',
  DB_POOL_MAX: parsePositiveInteger(process.env.DB_POOL_MAX, 10),
  DB_IDLE_TIMEOUT_MS: parsePositiveInteger(process.env.DB_IDLE_TIMEOUT_MS, 30000),
  DB_CONNECTION_TIMEOUT_MS: parsePositiveInteger(process.env.DB_CONNECTION_TIMEOUT_MS, 5000),

  DATABASE_URL: process.env.DATABASE_URL,

  JWT_SECRET: process.env.JWT_SECRET || 'laquinta_secret_dev_2026',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  JWT_EXPIRES_IN_SHORT: process.env.JWT_EXPIRES_IN_SHORT || '8h',
  JWT_EXPIRES_IN_REMEMBER: process.env.JWT_EXPIRES_IN_REMEMBER || '30d',
  APP_TIMEZONE,
  TRUST_PROXY_HOPS: parseInt(process.env.TRUST_PROXY_HOPS || '1', 10),
  CORS_ORIGINS: (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),

  isProduction,
  isDevelopment: process.env.NODE_ENV === 'development',
};
