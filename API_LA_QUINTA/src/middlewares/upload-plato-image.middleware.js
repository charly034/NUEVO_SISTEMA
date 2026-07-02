import multer from 'multer';
import { ApiError } from '../utils/ApiError.js';

const FORMATOS_PERMITIDOS = new Set(['image/jpeg', 'image/png', 'image/webp']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    if (!FORMATOS_PERMITIDOS.has(file.mimetype)) {
      cb(ApiError.badRequest('La imagen del plato debe ser JPG, PNG o WebP.'));
      return;
    }
    cb(null, true);
  },
});

export const uploadPlatoImage = (req, res, next) => {
  upload.single('foto')(req, res, (err) => {
    if (!err) return next();
    if (err instanceof ApiError) return next(err);
    if (err instanceof multer.MulterError) {
      const message = err.code === 'LIMIT_FILE_SIZE'
        ? 'La imagen del plato no puede superar 5 MB.'
        : 'No se pudo procesar la imagen del plato.';
      return next(ApiError.badRequest(message));
    }
    return next(err);
  });
};
