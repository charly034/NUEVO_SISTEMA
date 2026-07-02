import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiError } from '../../utils/ApiError.js';
import * as repo from './sugerencias-empleados.repository.js';

export const obtener = asyncHandler(async (req, res) => {
  const { semana_inicio } = req.query;
  if (!semana_inicio || !/^\d{4}-\d{2}-\d{2}$/.test(semana_inicio)) {
    throw new ApiError(400, 'semana_inicio requerida en formato YYYY-MM-DD');
  }
  const sugerencia = await repo.findBySemana(req.empleado.id, semana_inicio);
  res.json({ data: sugerencia });
});

export const crear = asyncHandler(async (req, res) => {
  const { semana_inicio, ideas, comentario } = req.body;
  if (!semana_inicio || !/^\d{4}-\d{2}-\d{2}$/.test(semana_inicio)) {
    throw new ApiError(400, 'semana_inicio requerida en formato YYYY-MM-DD');
  }
  if (!ideas || ideas.trim().length < 3) {
    throw new ApiError(400, 'Las ideas son obligatorias');
  }
  const sugerencia = await repo.crear({
    empleadoId: req.empleado.id,
    semanaInicio: semana_inicio,
    ideas: ideas.trim(),
    comentario: comentario?.trim() || null,
  });
  res.status(201).json({ data: sugerencia });
});
