import { ApiError } from '../utils/ApiError.js';
import { sendError } from '../utils/response.js';
import { HTTP_STATUS } from '../constants/http-status.js';
import { env } from '../config/env.js';

// Middleware de 4 parámetros: Express lo identifica como manejador de errores
export const errorMiddleware = (err, req, res, _next) => {
  // Error controlado lanzado intencionalmente desde la lógica
  if (err instanceof ApiError) {
    return sendError(res, err.message, err.errors, err.statusCode);
  }

  // Error de validación de body JSON mal formado
  if (err.type === 'entity.parse.failed') {
    return sendError(res, 'JSON inválido en el cuerpo de la petición', [], HTTP_STATUS.BAD_REQUEST);
  }

  // Cualquier otro error inesperado
  const message = env.isProduction ? 'Error interno del servidor' : err.message;
  const errors = env.isProduction ? [] : [err.stack];

  console.error('Error no controlado:', err);

  return sendError(res, message, errors, HTTP_STATUS.INTERNAL_SERVER_ERROR);
};
