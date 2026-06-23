import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/response.js';
import * as authService from './auth.service.js';

export const loginController = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email y contraseña requeridos' });
  }
  const data = await authService.login(email, password);
  sendSuccess(res, data, 'Login exitoso');
});

export const meController = asyncHandler(async (req, res) => {
  const empleado = await authService.getSession(req.empleado.sub);
  sendSuccess(res, empleado, 'Sesión vigente');
});
