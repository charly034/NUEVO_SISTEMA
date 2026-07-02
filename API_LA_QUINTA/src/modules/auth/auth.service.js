import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../../database/connection.js';
import { ApiError } from '../../utils/ApiError.js';
import { env } from '../../config/env.js';
import { findByCodigo } from '../empresas/empresas.repository.js';
import {
  findByEmail, create as createEmpleado,
  findByResetCode, clearResetCode, setPassword,
  findWithPasswordById,
} from '../empleados/empleados.repository.js';
import * as notificacionesService from '../notificaciones/notificaciones.service.js';

const CAMPOS_PREFERENCIAS = [
  'vegetariano',
  'sin_gluten',
  'sin_lacteos',
  'sin_pescado',
  'sin_frutos_secos',
  'recibir_recordatorios_whatsapp',
];

function normalizarPreferenciasSesion(preferencias = {}) {
  return {
    recibir_recordatorios_whatsapp: false,
    ...(preferencias || {}),
  };
}

function normalizarPreferenciasParciales(preferencias = {}) {
  return CAMPOS_PREFERENCIAS.reduce((acc, campo) => {
    if (Object.prototype.hasOwnProperty.call(preferencias, campo)) {
      acc[campo] = Boolean(preferencias[campo]);
    }
    return acc;
  }, {});
}

export const login = async (email, password, { remember = false } = {}) => {
  const result = await query(
    `SELECT e.id, e.nombre, e.apellido, e.email, e.password_hash, e.activo, e.rol,
            e.telefono, e.fecha_nacimiento, e.preferencias_alimentarias,
            emp.activo AS empresa_activa,
            e.empresa_id, emp.nombre AS empresa_nombre, emp.plan, emp.modo_pedido
     FROM empleados e
     JOIN empresas emp ON emp.id = e.empresa_id
     WHERE LOWER(e.email) = LOWER($1)`,
    [email.trim()]
  );

  const empleado = result.rows[0];
  if (!empleado) throw ApiError.unauthorized('Credenciales inválidas');
  if (!empleado.activo) throw ApiError.unauthorized('Usuario inactivo');
  if (!empleado.empresa_activa) throw ApiError.unauthorized('Empresa inactiva');

  const ok = await bcrypt.compare(password, empleado.password_hash);
  if (!ok) throw ApiError.unauthorized('Credenciales inválidas');

  const payload = {
    sub: empleado.id,
    empresa_id: empleado.empresa_id,
    nombre: empleado.nombre,
    apellido: empleado.apellido,
    rol: empleado.rol,
  };

  const expiresIn = remember ? (env.JWT_EXPIRES_IN_REMEMBER || '30d') : (env.JWT_EXPIRES_IN_SHORT || '8h');
  const token = jwt.sign(payload, env.JWT_SECRET, { expiresIn });

  return {
    token,
    empleado: {
      id: empleado.id,
      nombre: empleado.nombre,
      apellido: empleado.apellido,
      email: empleado.email,
      telefono: empleado.telefono,
      fecha_nacimiento: empleado.fecha_nacimiento,
      preferencias_alimentarias: normalizarPreferenciasSesion(empleado.preferencias_alimentarias),
      rol: empleado.rol,
      empresa: {
        id: empleado.empresa_id,
        nombre: empleado.empresa_nombre,
        plan: empleado.plan,
        modo_pedido: empleado.modo_pedido,
      },
    },
  };
};

export const hashPassword = (plain) => bcrypt.hash(plain, 10);

export const verificarCodigo = async (codigo) => {
  const empresa = await findByCodigo(codigo);
  if (!empresa) throw ApiError.notFound('Código de empresa no válido');
  if (!empresa.activo) throw ApiError.badRequest('Esta empresa no está activa');
  return { id: empresa.id, nombre: empresa.nombre };
};

export const registro = async ({ codigo, nombre, apellido, email, password, telefono, fecha_nacimiento }) => {
  const empresa = await findByCodigo(codigo);
  if (!empresa) throw ApiError.badRequest('Código de empresa inválido');
  if (!empresa.activo) throw ApiError.badRequest('Empresa inactiva');

  const emailTrim = email.trim().toLowerCase();
  const existe = await findByEmail(emailTrim);
  if (existe) throw ApiError.conflict('Ya existe una cuenta con ese email');

  const password_hash = await bcrypt.hash(password, 10);
  const empleado = await createEmpleado({
    empresa_id: empresa.id,
    nombre: nombre.trim(),
    apellido: apellido.trim(),
    email: emailTrim,
    password_hash,
    telefono: telefono?.trim() || null,
    fecha_nacimiento: fecha_nacimiento || null,
    rol: 'cliente',
  });

  notificacionesService.notificarNuevoRegistro({ empleado, empresa }).catch((error) => {
    console.error('Error al disparar notificaciones de nuevo registro:', error.message);
  });

  const payload = { sub: empleado.id, empresa_id: empresa.id, nombre: empleado.nombre, apellido: empleado.apellido, rol: 'cliente' };
  const token = jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN_SHORT || '8h' });

  return {
    token,
    empleado: {
      id: empleado.id,
      nombre: empleado.nombre,
      apellido: empleado.apellido,
      email: empleado.email,
      telefono: empleado.telefono,
      fecha_nacimiento: empleado.fecha_nacimiento,
      preferencias_alimentarias: normalizarPreferenciasSesion(empleado.preferencias_alimentarias),
      rol: 'cliente',
      empresa: { id: empresa.id, nombre: empresa.nombre },
    },
  };
};

// ── Recuperación de contraseña por código ────────────────────────────────────

export const usarResetCode = async (code, newPassword) => {
  const empleado = await findByResetCode(code);
  if (!empleado) throw ApiError.badRequest('Código inválido o ya utilizado');
  if (!empleado.activo) throw ApiError.badRequest('Cuenta inactiva');
  if (new Date() > new Date(empleado.reset_code_expires_at)) {
    throw ApiError.badRequest('El código expiró. Solicitá uno nuevo al administrador');
  }
  if (newPassword.length < 8) throw ApiError.badRequest('Mínimo 8 caracteres');
  const password_hash = await bcrypt.hash(newPassword, 10);
  await setPassword(empleado.id, password_hash);
  await clearResetCode(empleado.id);
  return { ok: true };
};

// ── Cambio de contraseña (logueado) ──────────────────────────────────────────

export const cambiarPassword = async (empleadoId, currentPassword, newPassword) => {
  const emp = await findWithPasswordById(empleadoId);
  if (!emp) throw ApiError.unauthorized('Sesión inválida');
  const ok = await bcrypt.compare(currentPassword, emp.password_hash);
  if (!ok) throw ApiError.badRequest('La contraseña actual es incorrecta');
  if (newPassword.length < 8) throw ApiError.badRequest('Mínimo 8 caracteres');
  if (currentPassword === newPassword) throw ApiError.badRequest('La nueva contraseña debe ser diferente');
  const password_hash = await bcrypt.hash(newPassword, 10);
  await setPassword(empleadoId, password_hash);
  return { ok: true };
};

export const getSession = async (empleadoId) => {
  const result = await query(
    `SELECT e.id, e.nombre, e.apellido, e.email, e.rol, e.activo,
            e.telefono, e.fecha_nacimiento, e.preferencias_alimentarias,
            e.empresa_id, emp.nombre AS empresa_nombre, emp.plan, emp.modo_pedido
     FROM empleados e
     JOIN empresas emp ON emp.id = e.empresa_id
     WHERE e.id = $1 AND e.activo = true AND emp.activo = true`,
    [empleadoId]
  );
  const empleado = result.rows[0];
  if (!empleado) throw ApiError.unauthorized('La sesión ya no es válida');

  return {
    id:                       empleado.id,
    nombre:                   empleado.nombre,
    apellido:                 empleado.apellido,
    email:                    empleado.email,
    telefono:                 empleado.telefono,
    fecha_nacimiento:         empleado.fecha_nacimiento,
    preferencias_alimentarias: normalizarPreferenciasSesion(empleado.preferencias_alimentarias),
    rol:                      empleado.rol,
    empresa: {
      id:          empleado.empresa_id,
      nombre:      empleado.empresa_nombre,
      plan:        empleado.plan,
      modo_pedido: empleado.modo_pedido,
    },
  };
};

export const actualizarPreferencias = async (empleadoId, preferencias) => {
  const preferenciasNormalizadas = normalizarPreferenciasParciales(preferencias);
  if (Object.keys(preferenciasNormalizadas).length === 0) {
    throw ApiError.badRequest('Sin preferencias para actualizar');
  }

  const r = await query(
    `UPDATE empleados
     SET preferencias_alimentarias = COALESCE(preferencias_alimentarias, '{}'::jsonb) || $1::jsonb
     WHERE id = $2
     RETURNING preferencias_alimentarias`,
    [JSON.stringify(preferenciasNormalizadas), empleadoId]
  );
  return normalizarPreferenciasSesion(r.rows[0]?.preferencias_alimentarias || {});
};

export const actualizarPerfil = async (empleadoId, { nombre, apellido, telefono, fecha_nacimiento }) => {
  const fields = {};
  if (nombre?.trim())   fields.nombre   = nombre.trim();
  if (apellido?.trim()) fields.apellido = apellido.trim();
  fields.telefono         = telefono?.trim() || null;
  fields.fecha_nacimiento = fecha_nacimiento || null;

  if (Object.keys(fields).length === 0) throw ApiError.badRequest('Sin datos para actualizar');

  const keys = Object.keys(fields);
  const vals = Object.values(fields);
  const set  = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
  vals.push(empleadoId);

  const r = await query(
    `UPDATE empleados SET ${set} WHERE id = $${vals.length}
     RETURNING id, nombre, apellido, email, telefono, fecha_nacimiento`,
    vals
  );
  return r.rows[0];
};
