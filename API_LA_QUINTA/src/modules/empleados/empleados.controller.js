import crypto from 'crypto';
import * as repo from './empleados.repository.js';
import { hashPassword } from '../auth/auth.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess, sendCreated, sendNoContent } from '../../utils/response.js';
import { ApiError } from '../../utils/ApiError.js';

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
  const { empresa_id, nombre, apellido, email, password, rol = 'cliente' } = req.body;
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
  });
  sendCreated(res, empleado, 'Empleado creado');
});

export const updateEmpleado = asyncHandler(async (req, res) => {
  const e = await repo.findById(req.params.id);
  if (!e) throw ApiError.notFound('Empleado no encontrado');

  const { password, ...rest } = req.body;
  const allowed = ['empresa_id', 'nombre', 'apellido', 'email', 'activo', 'rol'];
  const fields = Object.fromEntries(
    Object.entries(rest).filter(([key]) => allowed.includes(key))
  );
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

  sendSuccess(res, await repo.update(req.params.id, fields), 'Empleado actualizado');
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
  sendNoContent(res);
});
