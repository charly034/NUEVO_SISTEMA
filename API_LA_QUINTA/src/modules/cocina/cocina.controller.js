import * as service from './cocina.service.js';
import { sendSuccess } from '../../utils/response.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const getCocinaHoy = asyncHandler(async (req, res) => {
  // Acepta ?fecha=YYYY-MM-DD para override (QA/test), sino usa hoy en UTC-3
  const fecha = req.query.fecha ?? new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const data = await service.getCocinaHoy(fecha);
  sendSuccess(res, data, 'Vista de cocina del dia obtenida');
});

export const getCocinaSemana = asyncHandler(async (req, res) => {
  const data = await service.getCocinaSemana(req.params.menuId);
  sendSuccess(res, data, 'Vista de cocina de la semana obtenida');
});

export const getOfertaSemanal = asyncHandler(async (req, res) => {
  const data = await service.getOfertaSemanal(req.params.menuId);
  sendSuccess(res, data, 'Oferta semanal obtenida');
});

export const getEtiquetas = asyncHandler(async (req, res) => {
  const data = await service.getEtiquetas(req.params.menuId, req.params.dia);
  sendSuccess(res, data, 'Datos de etiquetas obtenidos');
});
