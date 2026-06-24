import { env } from './env.js';

const developmentOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:4200',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:5175',
  'http://127.0.0.1:4200',
];

const allowedOrigins = env.CORS_ORIGINS.length
  ? env.CORS_ORIGINS
  : (env.isProduction ? [] : developmentOrigins);

const isLocalhost = (origin) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

export const corsOptions = {
  origin: (origin, callback) => {
    // Permitir peticiones sin origin (Postman, curl, servidores)
    if (!origin) return callback(null, true);
    // En desarrollo: cualquier localhost es válido (puertos dinámicos del preview)
    if (!env.isProduction && isLocalhost(origin)) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`Origin ${origin} no permitido por CORS`));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};
