import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { query } from '../database/connection.js';

// Inyecta req.empleado si hay token válido, pero no bloquea si no hay
export const optionalAuth = async (req, res, next) => {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      const payload = jwt.verify(header.slice(7), env.JWT_SECRET);
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

export const requireAdmin = [
  requireAuth,
  (req, res, next) => {
    if (req.empleado.rol !== 'admin') {
      return res.status(403).json({ success: false, message: 'Se requiere acceso administrador' });
    }
    next();
  },
];
