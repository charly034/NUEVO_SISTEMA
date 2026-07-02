import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { query } from '../database/connection.js';

// ── Empleados (clientes) ──────────────────────────────────────────────────────

export const optionalAuth = async (req, res, next) => {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      const payload = jwt.verify(header.slice(7), env.JWT_SECRET);
      if (payload.tipo !== 'admin') {
        const result = await query(
          `SELECT e.id, e.empresa_id, e.nombre, e.apellido, e.rol
           FROM empleados e
           JOIN empresas emp ON emp.id = e.empresa_id
           WHERE e.id = $1 AND e.activo = true AND emp.activo = true`,
          [payload.sub]
        );
        if (result.rows[0]) {
          req.empleado = { ...payload, sub: result.rows[0].id, ...result.rows[0] };
        }
      }
    } catch { /* token inválido, ignorar */ }
  }
  next();
};

export const requireAuth = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Token requerido' });
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    // Rechazar tokens de admin en rutas de empleados
    if (payload.tipo === 'admin') {
      return res.status(403).json({ success: false, message: 'Token de tipo incorrecto' });
    }
    const result = await query(
      `SELECT e.id, e.empresa_id, e.nombre, e.apellido, e.rol
       FROM empleados e
       JOIN empresas emp ON emp.id = e.empresa_id
       WHERE e.id = $1 AND e.activo = true AND emp.activo = true`,
      [payload.sub]
    );
    const empleado = result.rows[0];
    if (!empleado) {
      return res.status(401).json({ success: false, message: 'La sesión ya no es válida' });
    }
    req.empleado = {
      ...payload,
      id: empleado.id,
      sub: empleado.id,
      empresa_id: empleado.empresa_id,
      nombre: empleado.nombre,
      apellido: empleado.apellido,
      rol: empleado.rol,
    };
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Token inválido o expirado' });
  }
};

// ── Usuarios admin (panel de gestión) ────────────────────────────────────────

export const requireAdminAuth = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Token requerido' });
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    if (payload.tipo !== 'admin') {
      return res.status(403).json({ success: false, message: 'Token de tipo incorrecto' });
    }
    const result = await query(
      `SELECT id, nombre, apellido, email, rol, activo FROM usuarios_admin WHERE id = $1 AND activo = true`,
      [payload.sub]
    );
    const usuario = result.rows[0];
    if (!usuario) {
      return res.status(401).json({ success: false, message: 'Sesión inválida' });
    }
    req.adminUser = {
      ...payload,
      sub: usuario.id,
      rol: usuario.rol,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      email: usuario.email,
    };
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Token inválido o expirado' });
  }
};

export const requireSuperAdmin = (req, res, next) => {
  if (req.adminUser?.rol !== 'superadmin') {
    return res.status(403).json({ success: false, message: 'Se requiere rol superadmin' });
  }
  next();
};

// requireAdmin ahora usa la nueva tabla de admin
export const requireAdmin = [requireAdminAuth];
