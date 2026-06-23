import * as usersService from './users.service.js';
import { sendSuccess, sendCreated, sendNoContent } from '../../utils/response.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

// El controller solo recibe el request, llama al service y devuelve la respuesta.
// No tiene lógica de negocio ni SQL.

export const getUsers = asyncHandler(async (req, res) => {
  const result = await usersService.getAllUsers(req.query);
  sendSuccess(res, result, 'Usuarios obtenidos exitosamente');
});

export const getUser = asyncHandler(async (req, res) => {
  const user = await usersService.getUserById(req.params.id);
  sendSuccess(res, user, 'Usuario obtenido exitosamente');
});

export const createUser = asyncHandler(async (req, res) => {
  const user = await usersService.createUser(req.body);
  sendCreated(res, user, 'Usuario creado exitosamente');
});

export const updateUser = asyncHandler(async (req, res) => {
  const user = await usersService.updateUser(req.params.id, req.body);
  sendSuccess(res, user, 'Usuario actualizado exitosamente');
});

export const deleteUser = asyncHandler(async (req, res) => {
  await usersService.deleteUser(req.params.id);
  sendNoContent(res);
});
