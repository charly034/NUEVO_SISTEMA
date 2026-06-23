import * as platosService from './platos.service.js';
import * as platosRepository from './platos.repository.js';
import { sendSuccess, sendCreated, sendNoContent } from '../../utils/response.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const getPlatos = asyncHandler(async (req, res) => {
  const result = await platosService.getAllPlatos(req.query);
  sendSuccess(res, result, 'Platos obtenidos exitosamente');
});

export const getPlato = asyncHandler(async (req, res) => {
  const plato = await platosService.getPlatoById(req.params.id);
  sendSuccess(res, plato, 'Plato obtenido exitosamente');
});

export const createPlato = asyncHandler(async (req, res) => {
  const plato = await platosService.createPlato(req.body);
  sendCreated(res, plato, 'Plato creado exitosamente');
});

export const updatePlato = asyncHandler(async (req, res) => {
  const plato = await platosService.updatePlato(req.params.id, req.body);
  sendSuccess(res, plato, 'Plato actualizado exitosamente');
});

export const deletePlato = asyncHandler(async (req, res) => {
  await platosService.deletePlato(req.params.id);
  sendNoContent(res);
});

export const getTags = asyncHandler(async (req, res) => {
  const tags = await platosRepository.findAllTags();
  sendSuccess(res, tags, 'Tags obtenidos exitosamente');
});
