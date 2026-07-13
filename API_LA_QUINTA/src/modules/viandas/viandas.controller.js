import * as viandasService from './viandas.service.js';
import { sendSuccess, sendCreated } from '../../utils/response.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const getViandas = asyncHandler(async (req, res) => {
  const viandas = await viandasService.getAllViandas(req.query);
  sendSuccess(res, viandas, 'Viandas obtenidas exitosamente');
});

export const getVianda = asyncHandler(async (req, res) => {
  const vianda = await viandasService.getViandaById(req.params.id);
  sendSuccess(res, vianda, 'Vianda obtenida exitosamente');
});

export const createVianda = asyncHandler(async (req, res) => {
  const vianda = await viandasService.createVianda(req.body);
  sendCreated(res, vianda, 'Vianda creada exitosamente');
});

export const updateVianda = asyncHandler(async (req, res) => {
  const vianda = await viandasService.updateVianda(req.params.id, req.body);
  sendSuccess(res, vianda, 'Vianda actualizada exitosamente');
});
