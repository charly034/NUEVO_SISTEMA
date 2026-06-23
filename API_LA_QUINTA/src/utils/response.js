import { HTTP_STATUS } from '../constants/http-status.js';

export const sendSuccess = (res, data = null, message = 'Operación exitosa', statusCode = HTTP_STATUS.OK) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

export const sendCreated = (res, data = null, message = 'Recurso creado exitosamente') => {
  return sendSuccess(res, data, message, HTTP_STATUS.CREATED);
};

export const sendNoContent = (res) => {
  return res.status(HTTP_STATUS.NO_CONTENT).send();
};

export const sendError = (res, message = 'Error interno del servidor', errors = [], statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR) => {
  return res.status(statusCode).json({
    success: false,
    message,
    errors,
  });
};
