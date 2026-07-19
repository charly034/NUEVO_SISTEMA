import * as service from './semanas.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/response.js';
import { ApiError } from '../../utils/ApiError.js';
import { semanaParamsSchema } from './semanas.validation.js';

export const getSemanas = asyncHandler(async (req, res) => {
  sendSuccess(res, await service.getAllSemanas(), 'Semanas obtenidas');
});

export const getSemanaActual = asyncHandler(async (req, res) => {
  sendSuccess(res, await service.getSemanaActual(), 'Semana actual');
});

export const getSemana = asyncHandler(async (req, res) => {
  const parsed = semanaParamsSchema.safeParse(req.params);
  if (!parsed.success) throw ApiError.badRequest('El id debe ser un numero entero positivo');
  sendSuccess(res, await service.getSemanaById(parsed.data.id), 'Semana obtenida');
});
