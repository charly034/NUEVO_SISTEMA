import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../../database/connection.js';
import { ApiError } from '../../utils/ApiError.js';
import { env } from '../../config/env.js';

export const login = async (email, password) => {
  const result = await query(
    `SELECT e.id, e.nombre, e.apellido, e.email, e.password_hash, e.activo, e.rol,
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

  const token = jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });

  return {
    token,
    empleado: {
      id: empleado.id,
      nombre: empleado.nombre,
      apellido: empleado.apellido,
      email: empleado.email,
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

export const getSession = async (empleadoId) => {
  const result = await query(
    `SELECT e.id, e.nombre, e.apellido, e.email, e.rol, e.activo,
            e.empresa_id, emp.nombre AS empresa_nombre, emp.plan, emp.modo_pedido
     FROM empleados e
     JOIN empresas emp ON emp.id = e.empresa_id
     WHERE e.id = $1 AND e.activo = true AND emp.activo = true`,
    [empleadoId]
  );
  const empleado = result.rows[0];
  if (!empleado) throw ApiError.unauthorized('La sesión ya no es válida');

  return {
    id: empleado.id,
    nombre: empleado.nombre,
    apellido: empleado.apellido,
    email: empleado.email,
    rol: empleado.rol,
    empresa: {
      id: empleado.empresa_id,
      nombre: empleado.empresa_nombre,
      plan: empleado.plan,
      modo_pedido: empleado.modo_pedido,
    },
  };
};
