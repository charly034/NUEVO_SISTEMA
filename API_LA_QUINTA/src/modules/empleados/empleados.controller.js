import crypto from 'crypto';
import * as repo from './empleados.repository.js';
import { hashPassword } from '../auth/auth.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess, sendCreated, sendNoContent } from '../../utils/response.js';
import { ApiError } from '../../utils/ApiError.js';
import * as auditoriaService from '../admin-auditoria/admin-auditoria.service.js';

export const getEmpleados = asyncHandler(async (req, res) => {
  const { empresa_id } = req.query;
  sendSuccess(res, await repo.findAll(empresa_id), 'Empleados obtenidos');
});

export const getEmpleado = asyncHandler(async (req, res) => {
  const e = await repo.findById(req.params.id);
  if (!e) throw ApiError.notFound('Empleado no encontrado');
  sendSuccess(res, e, 'Empleado obtenido');
});

export const createEmpleado = asyncHandler(async (req, res) => {
  const { empresa_id, nombre, apellido, email, password, rol = 'cliente', telefono, fecha_nacimiento } = req.body;
  if (!empresa_id || !nombre || !apellido || !email || !password) {
    throw ApiError.badRequest('empresa_id, nombre, apellido, email y password son requeridos');
  }
  if (!['cliente', 'admin'].includes(rol)) throw ApiError.badRequest('rol inválido');
  if (password.length < 8) throw ApiError.badRequest('La contraseña debe tener al menos 8 caracteres');
  const existe = await repo.findByEmail(email);
  if (existe) throw ApiError.conflict(`Ya existe un empleado con el email "${email}"`);

  const password_hash = await hashPassword(password);
  const empleado = await repo.create({
    empresa_id,
    nombre: nombre.trim(),
    apellido: apellido.trim(),
    email: email.trim().toLowerCase(),
    password_hash,
    rol,
    telefono: telefono?.trim() || null,
    fecha_nacimiento: fecha_nacimiento || null,
  });
  await auditoriaService.registrarAdminAction({
    adminUser: req.adminUser,
    accion: 'crear',
    entidad_tipo: 'empleado',
    entidad_id: empleado.id,
    resumen: `Creó empleado ${empleado.nombre} ${empleado.apellido}`,
    despues: empleado,
  });
  sendCreated(res, empleado, 'Empleado creado');
});

export const importarEmpleados = asyncHandler(async (req, res) => {
  const { empresa_id, empleados = [] } = req.body || {};
  if (!empresa_id) throw ApiError.badRequest('empresa_id es requerido');
  if (!Array.isArray(empleados) || empleados.length === 0) {
    throw ApiError.badRequest('empleados debe ser un array con al menos una fila');
  }
  if (empleados.length > 300) throw ApiError.badRequest('Máximo 300 empleados por importación');

  const creados = [];
  const omitidos = [];
  const errores = [];

  for (const [index, fila] of empleados.entries()) {
    const filaNumero = index + 1;
    const nombre = String(fila.nombre || '').trim();
    const apellido = String(fila.apellido || '').trim();
    const email = String(fila.email || '').trim().toLowerCase();
    const password = String(fila.password || '').trim();
    const rol = fila.rol || 'cliente';

    if (!nombre || !apellido || !email || !password) {
      errores.push({ fila: filaNumero, email, error: 'nombre, apellido, email y password son requeridos' });
      continue;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errores.push({ fila: filaNumero, email, error: 'email inválido' });
      continue;
    }
    if (password.length < 8) {
      errores.push({ fila: filaNumero, email, error: 'password mínimo 8 caracteres' });
      continue;
    }
    if (!['cliente', 'admin'].includes(rol)) {
      errores.push({ fila: filaNumero, email, error: 'rol inválido' });
      continue;
    }

    const existe = await repo.findByEmail(email);
    if (existe) {
      omitidos.push({ fila: filaNumero, email, motivo: 'email existente' });
      continue;
    }

    const password_hash = await hashPassword(password);
    const creado = await repo.create({
      empresa_id,
      nombre,
      apellido,
      email,
      password_hash,
      rol,
      telefono: String(fila.telefono || '').trim() || null,
      fecha_nacimiento: fila.fecha_nacimiento || null,
    });
    creados.push(creado);
  }

  await auditoriaService.registrarAdminAction({
    adminUser: req.adminUser,
    accion: 'importar_csv',
    entidad_tipo: 'empleado',
    entidad_id: empresa_id,
    resumen: `Importó empleados por CSV: ${creados.length} creados, ${omitidos.length} omitidos, ${errores.length} con error`,
    despues: { creados: creados.map((e) => ({ id: e.id, email: e.email })) },
    metadata: { empresa_id, total_filas: empleados.length, omitidos, errores },
  });

  sendSuccess(res, { creados, omitidos, errores }, 'Importación procesada');
});

export const updateEmpleado = asyncHandler(async (req, res) => {
  const e = await repo.findById(req.params.id);
  if (!e) throw ApiError.notFound('Empleado no encontrado');

  const { password, ...rest } = req.body;
  const allowed = ['empresa_id', 'nombre', 'apellido', 'email', 'activo', 'rol', 'telefono', 'fecha_nacimiento'];
  const fields = Object.fromEntries(
    Object.entries(rest).filter(([key]) => allowed.includes(key))
  );
  if ('telefono' in fields) fields.telefono = fields.telefono?.trim() || null;
  if ('fecha_nacimiento' in fields) fields.fecha_nacimiento = fields.fecha_nacimiento || null;
  if (fields.rol && !['cliente', 'admin'].includes(fields.rol)) {
    throw ApiError.badRequest('rol inválido');
  }
  if (req.empleado?.sub && Number(req.params.id) === Number(req.empleado.sub) && fields.rol === 'cliente') {
    throw ApiError.conflict('No podés quitarte tu propio acceso administrador');
  }
  if (password) {
    if (password.length < 8) throw ApiError.badRequest('La contraseña debe tener al menos 8 caracteres');
    fields.password_hash = await hashPassword(password);
  }
  if (Object.keys(fields).length === 0) throw ApiError.badRequest('No hay campos válidos para actualizar');

  const actualizado = await repo.update(req.params.id, fields);
  await auditoriaService.registrarAdminAction({
    adminUser: req.adminUser,
    accion: 'actualizar',
    entidad_tipo: 'empleado',
    entidad_id: req.params.id,
    resumen: `Actualizó empleado ${actualizado.nombre} ${actualizado.apellido}`,
    antes: e,
    despues: actualizado,
  });
  sendSuccess(res, actualizado, 'Empleado actualizado');
});

const CHARS_RESET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function genResetCode() {
  // Formato legible: XXX-XXX (6 chars con guión), generado con crypto para mayor seguridad
  const parte = () => {
    const bytes = crypto.randomBytes(3);
    return Array.from(bytes, (b) => CHARS_RESET[b % CHARS_RESET.length]).join('');
  };
  return `${parte()}-${parte()}`;
}

export const generarResetCode = asyncHandler(async (req, res) => {
  const e = await repo.findById(req.params.id);
  if (!e) throw ApiError.notFound('Empleado no encontrado');
  const code = genResetCode();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24hs
  await repo.setResetCode(e.id, code, expiresAt);
  sendSuccess(res, {
    codigo: code,
    expira: expiresAt.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }),
    empleado: `${e.nombre} ${e.apellido}`,
  }, 'Código generado');
});

export const deleteEmpleado = asyncHandler(async (req, res) => {
  if (req.empleado?.sub && Number(req.params.id) === Number(req.empleado.sub)) {
    throw ApiError.conflict('No podés eliminar tu propia cuenta');
  }
  const e = await repo.findById(req.params.id);
  if (!e) throw ApiError.notFound('Empleado no encontrado');
  await repo.remove(req.params.id);
  await auditoriaService.registrarAdminAction({
    adminUser: req.adminUser,
    accion: 'eliminar',
    entidad_tipo: 'empleado',
    entidad_id: req.params.id,
    resumen: `Eliminó empleado ${e.nombre} ${e.apellido}`,
    antes: e,
  });
  sendNoContent(res);
});
