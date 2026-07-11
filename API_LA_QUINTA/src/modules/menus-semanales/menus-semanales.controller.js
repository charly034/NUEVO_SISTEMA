import * as service from './menus-semanales.service.js';
import { sendSuccess, sendCreated, sendNoContent } from '../../utils/response.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

// ── Menús semanales ───────────────────────────────────────────────

export const getMenusSemanales = asyncHandler(async (req, res) => {
  const result = await service.getAllMenusSemanales(req.query);
  sendSuccess(res, result, 'Menús semanales obtenidos exitosamente');
});

export const getMenuSemanal = asyncHandler(async (req, res) => {
  const menu = await service.getMenuSemanalById(req.params.id);
  sendSuccess(res, menu, 'Menú semanal obtenido exitosamente');
});

export const getDisenoMenuSemanal = asyncHandler(async (req, res) => {
  const diseno = await service.getDisenoMenuSemanal(req.params.id);
  sendSuccess(res, diseno, 'Diseño del menú semanal obtenido exitosamente');
});

export const createMenuSemanal = asyncHandler(async (req, res) => {
  const admin_id = req.adminUser?.sub ?? null;
  const menu = await service.createMenuSemanal(req.body, admin_id, req.adminUser);
  sendCreated(res, menu, 'Menú semanal creado exitosamente');
});

export const updateMenuSemanal = asyncHandler(async (req, res) => {
  const admin_id = req.adminUser?.sub ?? null;
  const menu = await service.updateMenuSemanal(req.params.id, req.body, admin_id, req.adminUser);
  sendSuccess(res, menu, 'Menú semanal actualizado exitosamente');
});

export const deleteMenuSemanal = asyncHandler(async (req, res) => {
  await service.deleteMenuSemanal(req.params.id, req.adminUser);
  sendNoContent(res);
});

export const duplicarMenuSemanal = asyncHandler(async (req, res) => {
  const menu = await service.duplicarMenuSemanal(req.params.id, req.body, req.adminUser);
  sendCreated(res, menu, 'Menú semanal duplicado exitosamente');
});

// ── Platos por día ────────────────────────────────────────────────

export const getPlatosByDia = asyncHandler(async (req, res) => {
  const platos = await service.getPlatosByDia(req.params.id, req.params.dia);
  sendSuccess(res, platos, `Platos del ${req.params.dia} obtenidos exitosamente`);
});

export const agregarPlatoDia = asyncHandler(async (req, res) => {
  const resultado = await service.agregarPlatoDia(req.params.id, req.body, req.adminUser);
  sendCreated(res, resultado, `Plato agregado al ${req.body.dia} opción ${req.body.opcion ?? 'A'}`);
});

export const setEmpresasSlot = asyncHandler(async (req, res) => {
  const { id, dia, opcion } = req.params;
  const result = await service.setEmpresasSlot(id, dia, opcion, req.body, req.adminUser);
  sendSuccess(res, result, 'Visibilidad de empresas actualizada');
});

export const actualizarGuarnicionSlot = asyncHandler(async (req, res) => {
  const { id, dia, opcion } = req.params;
  const slot = await service.actualizarGuarnicionSlot(id, dia, opcion, req.body, req.adminUser);
  sendSuccess(res, slot, 'Guarnición del slot actualizada');
});

export const actualizarSalsaSlot = asyncHandler(async (req, res) => {
  const { id, dia, opcion } = req.params;
  const slot = await service.actualizarSalsaSlot(id, dia, opcion, req.body, req.adminUser);
  sendSuccess(res, slot, 'Salsa del slot actualizada');
});

export const quitarPlatoDia = asyncHandler(async (req, res) => {
  await service.quitarPlatoDia(req.params.id, req.params.dia, req.params.opcion, req.adminUser);
  sendNoContent(res);
});

// ── Días sin servicio ─────────────────────────────────────────────

export const marcarSinServicio = asyncHandler(async (req, res) => {
  const resultado = await service.marcarSinServicio(req.params.id, req.body, req.adminUser);
  sendCreated(res, resultado, `${req.body.dia} marcado como sin servicio`);
});

export const quitarSinServicio = asyncHandler(async (req, res) => {
  await service.quitarSinServicio(req.params.id, req.params.dia, req.adminUser);
  sendNoContent(res);
});

// ── Ciclo de vida ─────────────────────────────────────────────────

export const cambiarEstadoMenu = asyncHandler(async (req, res) => {
  const menu = await service.cambiarEstadoMenu(req.params.id, req.body.estado, req.body, req.adminUser);
  sendSuccess(res, menu, `Menú ${req.body.estado} exitosamente`);
});

// ── Historial ─────────────────────────────────────────────────────

export const getHistorialPorPlato = asyncHandler(async (req, res) => {
  const result = await service.getHistorialPorPlato(req.params.platoId);
  sendSuccess(res, result, 'Historial del plato obtenido exitosamente');
});

// Platos usados en el período indicado — para detectar repeticiones
// Filtros (query params): dias | mes | semana | desde + hasta
export const getPlatosUsados = asyncHandler(async (req, res) => {
  const result = await service.getPlatosUsados(req.query);
  sendSuccess(res, result, 'Platos usados en el período indicado');
});

// Platos NO usados en el período indicado — candidatos para el próximo menú
export const getPlatosNoUsados = asyncHandler(async (req, res) => {
  const result = await service.getPlatosNoUsados(req.query);
  sendSuccess(res, result, 'Platos no usados en el período indicado');
});
