import { env } from '../config/env.js';

export const requestLoggerMiddleware = (req, res, next) => {
  if (env.isProduction) return next();

  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${req.method}] ${req.originalUrl} → ${res.statusCode} (${duration}ms)`);
  });
  next();
};
