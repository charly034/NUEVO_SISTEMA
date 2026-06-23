import { ApiError } from '../utils/ApiError.js';

export const notFoundMiddleware = (req, res, next) => {
  next(ApiError.notFound(`Ruta no encontrada: ${req.method} ${req.originalUrl}`));
};
