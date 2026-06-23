import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { ApiError } from '../../utils/ApiError.js';
import { env } from '../../config/env.js';
import * as repo from '../usuarios-admin/usuarios-admin.repository.js';

export const login = async (email, password) => {
  const usuario = await repo.findByEmail(email);
  if (!usuario) throw ApiError.unauthorized('Credenciales inválidas');
  if (!usuario.activo) throw ApiError.unauthorized('Usuario inactivo');

  const ok = await bcrypt.compare(password, usuario.password_hash);
  if (!ok) throw ApiError.unauthorized('Credenciales inválidas');

  const payload = {
    sub:   usuario.id,
    tipo:  'admin',          // distingue de tokens de empleados
    nombre: usuario.nombre,
    apellido: usuario.apellido,
    rol:   usuario.rol,
  };

  const token = jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN_REMEMBER || '30d',
  });

  return {
    token,
    usuario: {
      id:      usuario.id,
      nombre:  usuario.nombre,
      apellido: usuario.apellido,
      email:   usuario.email,
      rol:     usuario.rol,
    },
  };
};

export const getSession = async (id) => {
  const u = await repo.findById(id);
  if (!u || !u.activo) throw ApiError.unauthorized('Sesión inválida');
  return { id: u.id, nombre: u.nombre, apellido: u.apellido, email: u.email, rol: u.rol };
};

export const hashPassword = (plain) => bcrypt.hash(plain, 10);
