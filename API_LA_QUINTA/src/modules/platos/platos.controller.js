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

export const getVisibilidadEmpresas = asyncHandler(async (req, res) => {
  const result = await platosService.getVisibilidadEmpresas(req.params.id);
  sendSuccess(res, result, 'Visibilidad de empresas obtenida');
});

export const setVisibilidadEmpresas = asyncHandler(async (req, res) => {
  const empresa_ids = (req.body.empresa_ids ?? []).map(Number);
  const result = await platosService.setVisibilidadEmpresas(req.params.id, empresa_ids);
  sendSuccess(res, result, 'Visibilidad de empresas actualizada');
});

export const getDisponibilidadLocal = asyncHandler(async (req, res) => {
  const result = await platosService.getDisponibilidadLocal(req.params.id);
  sendSuccess(res, result, 'Disponibilidad en el local obtenida');
});

export const setDisponibilidadLocal = asyncHandler(async (req, res) => {
  const result = await platosService.setDisponibilidadLocal(req.params.id, req.body.entradas ?? []);
  sendSuccess(res, result, 'Disponibilidad en el local actualizada');
});

export const createPlato = asyncHandler(async (req, res) => {
  const plato = await platosService.createPlato(req.body, req.file);
  sendCreated(res, plato, 'Plato creado exitosamente');
});

export const updatePlato = asyncHandler(async (req, res) => {
  const plato = await platosService.updatePlato(req.params.id, req.body, req.file);
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
