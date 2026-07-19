import * as service from './configuracion.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/response.js';
import { ApiError } from '../../utils/ApiError.js';
import { coloresCeldaSchema } from './configuracion.validation.js';
import * as auditoriaService from '../admin-auditoria/admin-auditoria.service.js';

export const getMenuColores = asyncHandler(async (req, res) => {
  sendSuccess(res, await service.getMenuColores(), 'Colores obtenidos');
});

export const updateMenuColores = asyncHandler(async (req, res) => {
  const parsed = coloresCeldaSchema.safeParse(req.body);
  if (!parsed.success) {
    throw ApiError.badRequest(
      'Colores inválidos: ' + parsed.error.issues.map((i) => i.message).join(', ')
    );
  }
  const antes = await service.getMenuColores();
  const colores = await service.setMenuColores(parsed.data);
  await auditoriaService.registrarAdminAction({
    adminUser: req.adminUser,
    accion: 'actualizar',
    entidad_tipo: 'configuracion',
    entidad_id: 'menu_resumen_colores',
    resumen: 'Actualizó los colores de las celdas del resumen semanal',
    antes,
    despues: colores,
  });
  sendSuccess(res, colores, 'Colores actualizados');
});
