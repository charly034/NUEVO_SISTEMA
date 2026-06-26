import { env } from "./env.js";

const developmentOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://localhost:4200",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "http://127.0.0.1:5175",
  "http://127.0.0.1:4200",
];

const allowedOrigins = env.CORS_ORIGINS.length
  ? env.CORS_ORIGINS
  : env.isProduction
    ? []
    : developmentOrigins;

const isLocalhost = (origin) =>
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
const isPrivateNetworkOrigin = (origin) => {
  const match = origin.match(/^https?:\/\/(\d+\.\d+\.\d+\.\d+)(:\d+)?$/);
  if (!match) return false;
  const [a, b] = match[1].split(".").map(Number);

  // Rangos IPv4 privados RFC1918
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;

  return false;
};

export const corsOptions = {
  origin: (origin, callback) => {
    // Permitir peticiones sin origin (Postman, curl, servidores)
    if (!origin) return callback(null, true);
    // En desarrollo: localhost y red local son válidos (pruebas desde celular/LAN)
    if (!env.isProduction && isLocalhost(origin)) return callback(null, true);
    if (!env.isProduction && isPrivateNetworkOrigin(origin))
      return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`Origin ${origin} no permitido por CORS`));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};
