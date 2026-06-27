import { HTTP_STATUS } from '../constants/http-status.js';

export class ApiError extends Error {
  constructor(statusCode, message, errors = []) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.errors = errors;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message, errors = []) {
    return new ApiError(HTTP_STATUS.BAD_REQUEST, message, errors);
  }

  static unauthorized(message = 'No autorizado') {
    return new ApiError(HTTP_STATUS.UNAUTHORIZED, message);
  }

  static forbidden(message = 'Acceso denegado') {
    return new ApiError(HTTP_STATUS.FORBIDDEN, message);
  }

  static notFound(message = 'Recurso no encontrado') {
    return new ApiError(HTTP_STATUS.NOT_FOUND, message);
  }

  static conflict(message) {
    return new ApiError(HTTP_STATUS.CONFLICT, message);
  }

  static unprocessable(message, errors = []) {
    return new ApiError(HTTP_STATUS.UNPROCESSABLE_ENTITY, message, errors);
  }

  static internal(message = 'Error interno del servidor') {
    return new ApiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, message);
  }
}
