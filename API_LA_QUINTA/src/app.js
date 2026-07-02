import express from 'express';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { rateLimit } from 'express-rate-limit';

import { corsOptions } from './config/cors.js';
import { env } from './config/env.js';
import routes from './routes/index.js';
import { errorMiddleware } from './middlewares/error.middleware.js';
import { notFoundMiddleware } from './middlewares/not-found.middleware.js';
import { requestLoggerMiddleware } from './middlewares/request-logger.middleware.js';

const app = express();

// Easypanel/Traefik entrega la IP real a través de un proxy inverso.
app.set('trust proxy', env.TRUST_PROXY_HOPS);

// Seguridad HTTP básica
app.use(helmet());

// CORS configurable por entorno
app.use(cors(corsOptions));

// Parseo de JSON con límite para evitar payloads gigantes
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Logger HTTP (solo en desarrollo)
if (env.isDevelopment) {
  app.use(morgan('dev'));
}

// Logger de requests personalizado
app.use(requestLoggerMiddleware);

app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));

// Rate limiting global: máximo 1000 requests por IP cada 15 minutos
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Demasiadas peticiones desde esta IP. Intentá de nuevo en 15 minutos.',
    errors: [],
  },
});
app.use('/api', limiter);

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // ventana de 15 minutos
  max: 10,                    // 10 intentos por IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Demasiados intentos de acceso. Intentá nuevamente en 15 minutos.',
    errors: [],
  },
});
app.use('/api/v1/auth/login', loginLimiter);
app.use('/api/v1/admin/auth/login', loginLimiter);

const registroLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,  // ventana de 1 hora
  max: 5,                     // 5 intentos por IP por hora
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Demasiados intentos de registro. Intentá nuevamente en una hora.',
    errors: [],
  },
});
app.use('/api/v1/auth/registro', registroLimiter);
app.use('/api/v1/auth/usar-reset-code', registroLimiter);

// Rutas versionadas
app.use('/api', routes);

// Ruta raíz informativa
app.get('/', (req, res) => {
  res.json({ message: 'API La Quinta — usa /api/v1/health para verificar el estado' });
});

// 404 para rutas no encontradas
app.use(notFoundMiddleware);

// Manejo centralizado de errores (debe ir al final)
app.use(errorMiddleware);

export default app;
