import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiError } from '../../utils/ApiError.js';
import { sugerirSemana } from './sugerencias.service.js';

export const getSugerencias = asyncHandler(async (req, res) => {
  const { fecha_inicio } = req.query;
  if (!fecha_inicio || !/^\d{4}-\d{2}-\d{2}$/.test(fecha_inicio)) {
    throw new ApiError(400, 'fecha_inicio requerida en formato YYYY-MM-DD');
  }
  const data = await sugerirSemana(fecha_inicio);
  res.json({ data });
});
