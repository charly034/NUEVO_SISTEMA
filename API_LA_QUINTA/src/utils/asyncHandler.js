// Envuelve un controller async para capturar errores automáticamente
// y pasarlos al middleware de errores con next(err).
// Sin esto, Express no captura errores de promesas rechazadas.
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
