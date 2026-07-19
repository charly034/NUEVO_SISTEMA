import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess, sendCreated } from '../../utils/response.js';
import { ApiError } from '../../utils/ApiError.js';
import * as service from './admin-auth.service.js';
import * as repo from '../usuarios-admin/usuarios-admin.repository.js';
import * as auditoriaService from '../admin-auditoria/admin-auditoria.service.js';

// Los objetos devueltos por el repo de usuarios-admin (findById/create/update)
// exponen solo CAMPOS no sensibles (id, nombre, apellido, email, rol, activo,
// created_at); NUNCA incluyen password_hash. Auditamos directamente esos
// objetos: nunca debe filtrarse un secreto a antes/despues.
const soloCamposSeguros = (u) => (u && {
  id: u.id,
  nombre: u.nombre,
  apellido: u.apellido,
  email: u.email,
  rol: u.rol,
  activo: u.activo,
});

export const loginController = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ success: false, message: 'Email y contraseña requeridos' });
  const data = await service.login(email, password);
  sendSuccess(res, data, 'Login exitoso');
});

export const meController = asyncHandler(async (req, res) => {
  const data = await service.getSession(req.adminUser.sub);
  sendSuccess(res, data, 'Sesión vigente');
});

// ── Gestión de usuarios admin (solo superadmin) ──────────────────────────────

export const listController = asyncHandler(async (req, res) => {
  sendSuccess(res, await repo.findAll(), 'Usuarios obtenidos');
});

export const createController = asyncHandler(async (req, res) => {
  const { nombre, apellido, email, password, rol = 'admin' } = req.body;
  if (!nombre || !apellido || !email || !password)
    throw ApiError.badRequest('Faltan campos obligatorios');
  if (!['admin', 'superadmin'].includes(rol))
    throw ApiError.badRequest('Rol inválido');
  if (password.length < 8)
    throw ApiError.badRequest('La contraseña debe tener al menos 8 caracteres');
  const existe = await repo.findByEmail(email);
  if (existe) throw ApiError.conflict('Ya existe un usuario con ese email');
  const password_hash = await service.hashPassword(password);
  const u = await repo.create({ nombre, apellido, email, password_hash, rol });
  await auditoriaService.registrarAdminAction({
    adminUser: req.adminUser,
    accion: 'crear',
    entidad_tipo: 'usuario_admin',
    entidad_id: u.id,
    resumen: `Creó el usuario admin ${u.nombre} ${u.apellido} (${u.rol})`,
    despues: soloCamposSeguros(u),
  });
  sendCreated(res, u, 'Usuario creado');
});

export const updateController = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const u = await repo.findById(id);
  if (!u) throw ApiError.notFound('Usuario no encontrado');
  const allowed = ['nombre', 'apellido', 'activo', 'rol'];
  const fields = Object.fromEntries(
    Object.entries(req.body).filter(([k]) => allowed.includes(k))
  );
  if (req.body.password) {
    if (req.body.password.length < 8) throw ApiError.badRequest('Mínimo 8 caracteres');
    fields.password_hash = await service.hashPassword(req.body.password);
  }
  if (Number(id) === req.adminUser.sub) {
    if (fields.activo === false) throw ApiError.badRequest('No podes desactivar tu propio usuario');
    if (fields.rol && fields.rol !== 'superadmin') {
      throw ApiError.badRequest('No podes quitarte tu propio rol superadmin');
    }
  }
  if (u.rol === 'superadmin' && u.activo && (fields.activo === false || fields.rol === 'admin')) {
    const totalSuperadmins = await repo.countActiveSuperAdmins();
    if (totalSuperadmins <= 1) {
      throw ApiError.badRequest('Debe quedar al menos un superadmin activo');
    }
  }
  if (Object.keys(fields).length === 0) throw ApiError.badRequest('Sin campos válidos');
  const updated = await repo.update(id, fields);
  await auditoriaService.registrarAdminAction({
    adminUser: req.adminUser,
    accion: 'actualizar',
    entidad_tipo: 'usuario_admin',
    entidad_id: id,
    resumen: `Actualizó el usuario admin ${updated.nombre} ${updated.apellido}`,
    antes: soloCamposSeguros(u),
    despues: soloCamposSeguros(updated),
    metadata: { cambio_password: Boolean(req.body.password) },
  });
  sendSuccess(res, updated, 'Usuario actualizado');
});

export const deleteController = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (Number(id) === req.adminUser.sub)
    throw ApiError.badRequest('No podés eliminar tu propio usuario');
  const u = await repo.findById(id);
  if (!u) throw ApiError.notFound('Usuario no encontrado');
  await repo.remove(id);
  await auditoriaService.registrarAdminAction({
    adminUser: req.adminUser,
    accion: 'eliminar',
    entidad_tipo: 'usuario_admin',
    entidad_id: id,
    resumen: `Eliminó el usuario admin ${u.nombre} ${u.apellido}`,
    antes: soloCamposSeguros(u),
  });
  res.status(204).end();
});
