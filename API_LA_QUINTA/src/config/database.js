import { env } from './env.js';

const poolOptions = {
  max: env.DB_POOL_MAX,
  idleTimeoutMillis: env.DB_IDLE_TIMEOUT_MS,
  connectionTimeoutMillis: env.DB_CONNECTION_TIMEOUT_MS,
};

// Usar DATABASE_URL si está disponible (útil en producción/deploy)
// Si no, armar la config con variables individuales (útil en desarrollo local)
export const dbConfig = env.DATABASE_URL
  ? {
      connectionString: env.DATABASE_URL,
      ssl: env.DB_SSL ? { rejectUnauthorized: false } : false,
      options: `-c timezone=${env.APP_TIMEZONE}`,
      ...poolOptions,
    }
  : {
      host: env.DB_HOST,
      port: env.DB_PORT,
      database: env.DB_NAME,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      ssl: env.DB_SSL ? { rejectUnauthorized: false } : false,
      options: `-c timezone=${env.APP_TIMEZONE}`,
      ...poolOptions,
    };
