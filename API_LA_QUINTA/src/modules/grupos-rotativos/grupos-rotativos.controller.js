import * as service from './grupos-rotativos.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess, sendCreated } from '../../utils/response.js';

export const getCiclos = asyncHandler(async (req, res) => {
  const ciclos = await service.listarCiclos(req.query);
  sendSuccess(res, ciclos, 'Ciclos de rotación obtenidos');
});

export const getCicloDetalle = asyncHandler(async (req, res) => {
  const ciclo = await service.obtenerCicloConDetalle(Number(req.params.id));
  sendSuccess(res, ciclo, 'Detalle del ciclo de rotación obtenido');
});

export const postCiclo = asyncHandler(async (req, res) => {
  const ciclo = await service.crearCiclo(req.body);
  sendCreated(res, ciclo, 'Ciclo de rotación creado');
});

export const patchCiclo = asyncHandler(async (req, res) => {
  const ciclo = await service.actualizarCiclo(Number(req.params.id), req.body);
  sendSuccess(res, ciclo, 'Ciclo de rotación actualizado');
});

export const postGrupo = asyncHandler(async (req, res) => {
  const grupo = await service.crearGrupo(req.body);
  sendCreated(res, grupo, 'Grupo rotativo creado');
});

export const patchGrupo = asyncHandler(async (req, res) => {
  const grupo = await service.actualizarGrupo(Number(req.params.id), req.body);
  sendSuccess(res, grupo, 'Grupo rotativo actualizado');
});

export const postPlatoDeGrupo = asyncHandler(async (req, res) => {
  const platos = await service.agregarPlatoAGrupo(Number(req.params.grupoId), req.body.plato_id, req.body.orden);
  sendSuccess(res, platos, 'Plato agregado al grupo rotativo');
});

export const deletePlatoDeGrupo = asyncHandler(async (req, res) => {
  const platos = await service.quitarPlatoDeGrupo(Number(req.params.grupoId), Number(req.params.platoId));
  sendSuccess(res, platos, 'Plato quitado del grupo rotativo');
});

export const postSeleccionSemana = asyncHandler(async (req, res) => {
  const seleccion = await service.forzarSeleccionSemana(req.body);
  sendSuccess(res, seleccion, 'Excepción de rotación aplicada para esta semana');
});

export const deleteSeleccionSemana = asyncHandler(async (req, res) => {
  await service.quitarSeleccionSemana(Number(req.query.menu_semanal_id), Number(req.params.cicloId));
  sendSuccess(res, { ok: true }, 'Excepción de rotación eliminada');
});
