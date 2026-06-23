import { ZodError } from 'zod';
import { ApiError } from '../utils/ApiError.js';

// Middleware genérico de validación con Zod.
// Recibe un objeto con schemas opcionales para body, params y query.
// Ejemplo de uso en una ruta:
//   router.post('/', validate({ body: createUserSchema }), controller)
export const validate = (schemas) => (req, res, next) => {
  try {
    if (schemas.body) {
      req.body = schemas.body.parse(req.body);
    }
    if (schemas.params) {
      req.params = schemas.params.parse(req.params);
    }
    if (schemas.query) {
      req.query = schemas.query.parse(req.query);
    }
    next();
  } catch (err) {
    if (err instanceof ZodError) {
      const errors = err.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      return next(ApiError.badRequest('Error de validación', errors));
    }
    next(err);
  }
};
