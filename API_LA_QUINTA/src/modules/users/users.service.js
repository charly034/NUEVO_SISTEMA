import * as usersRepository from './users.repository.js';
import { ApiError } from '../../utils/ApiError.js';

// El service contiene la lógica de negocio.
// Decide qué hacer, cuándo hacerlo y qué errores lanzar.
// NO hace queries SQL directamente.

export const getAllUsers = async ({ page = 1, limit = 10 } = {}) => {
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const offset = (pageNum - 1) * limitNum;

  const [users, total] = await Promise.all([
    usersRepository.findAll({ limit: limitNum, offset }),
    usersRepository.countAll(),
  ]);

  return {
    users,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    },
  };
};

export const getUserById = async (id) => {
  const user = await usersRepository.findById(id);
  if (!user) {
    throw ApiError.notFound(`Usuario con id ${id} no encontrado`);
  }
  return user;
};

export const createUser = async (data) => {
  const existing = await usersRepository.findByEmail(data.email);
  if (existing) {
    throw ApiError.conflict(`El email ${data.email} ya está registrado`);
  }
  return usersRepository.create(data);
};

export const updateUser = async (id, data) => {
  const user = await usersRepository.findById(id);
  if (!user) {
    throw ApiError.notFound(`Usuario con id ${id} no encontrado`);
  }

  if (data.email && data.email !== user.email) {
    const existing = await usersRepository.findByEmail(data.email);
    if (existing) {
      throw ApiError.conflict(`El email ${data.email} ya está registrado`);
    }
  }

  return usersRepository.update(id, data);
};

export const deleteUser = async (id) => {
  const deleted = await usersRepository.remove(id);
  if (!deleted) {
    throw ApiError.notFound(`Usuario con id ${id} no encontrado`);
  }
};
