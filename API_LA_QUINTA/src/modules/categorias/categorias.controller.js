import * as service from './categorias.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess, sendCreated } from '../../utils/response.js';

// ── Categorías ──────────────────────────────────────────────────────────

export const getCategorias = asyncHandler(async (req, res) => {
  const categorias = await service.listar(req.query || {});
  sendSuccess(res, categorias, 'Categorías obtenidas');
});

export const getCategoria = asyncHandler(async (req, res) => {
  const categoria = await service.obtenerConDetalle(Number(req.params.id));
  sendSuccess(res, categoria, 'Detalle de categoría obtenido');
});

export const postCategoria = asyncHandler(async (req, res) => {
  const categoria = await service.crear(req.body);
  sendCreated(res, categoria, 'Categoría creada');
});

export const patchCategoria = asyncHandler(async (req, res) => {
  const categoria = await service.actualizar(Number(req.params.id), req.body);
  sendSuccess(res, categoria, 'Categoría actualizada');
});

export const deleteCategoria = asyncHandler(async (req, res) => {
  await service.eliminar(Number(req.params.id));
  sendSuccess(res, { ok: true }, 'Categoría eliminada');
});

export const postDuplicarCategoria = asyncHandler(async (req, res) => {
  const categoria = await service.duplicar(Number(req.params.id), req.body || {});
  sendCreated(res, categoria, 'Categoría duplicada');
});

// ── Grupos ──────────────────────────────────────────────────────────────

export const postGrupo = asyncHandler(async (req, res) => {
  const grupo = await service.crearGrupo(Number(req.params.id), req.body);
  sendCreated(res, grupo, 'Grupo creado');
});

export const patchGrupo = asyncHandler(async (req, res) => {
  const grupo = await service.actualizarGrupo(Number(req.params.id), Number(req.params.grupoId), req.body);
  sendSuccess(res, grupo, 'Grupo actualizado');
});

export const deleteGrupo = asyncHandler(async (req, res) => {
  await service.eliminarGrupo(Number(req.params.id), Number(req.params.grupoId));
  sendSuccess(res, { ok: true }, 'Grupo eliminado');
});

export const postPlatoDeGrupo = asyncHandler(async (req, res) => {
  const platos = await service.agregarPlatoAGrupo(
    Number(req.params.id), Number(req.params.grupoId), req.body.plato_id, req.body.orden,
  );
  sendSuccess(res, platos, 'Plato agregado al grupo');
});

export const deletePlatoDeGrupo = asyncHandler(async (req, res) => {
  const platos = await service.quitarPlatoDeGrupo(
    Number(req.params.id), Number(req.params.grupoId), Number(req.params.platoId),
  );
  sendSuccess(res, platos, 'Plato quitado del grupo');
});

export const getGruposActivos = asyncHandler(async (req, res) => {
  const grupos = await service.resolverGruposActivos(Number(req.params.id), req.query.fecha_inicio);
  sendSuccess(res, grupos, 'Grupos activos de la semana resueltos');
});

// ── Rotación por semana ─────────────────────────────────────────────────

export const postResembrarRotacion = asyncHandler(async (req, res) => {
  await service.resembrarRotacionCategoria(req.body.menu_semanal_id, Number(req.params.id));
  sendSuccess(res, { ok: true }, 'Rotación re-sembrada para esta semana');
});

export const putForzarGrupo = asyncHandler(async (req, res) => {
  await service.forzarGrupoSemana(req.body.menu_semanal_id, Number(req.params.id), req.body.grupo_id);
  sendSuccess(res, { ok: true }, 'Grupo forzado para esta semana');
});

export const deleteForzarGrupo = asyncHandler(async (req, res) => {
  await service.quitarGrupoForzadoSemana(req.body.menu_semanal_id, Number(req.params.id));
  sendSuccess(res, { ok: true }, 'Se volvió al cálculo automático de rotación');
});
