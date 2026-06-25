import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/response.js';
import * as authService from './auth.service.js';

export const loginController = asyncHandler(async (req, res) => {
  const { email, password, remember = false } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email y contraseña requeridos' });
  }
  const data = await authService.login(email, password, { remember: Boolean(remember) });
  sendSuccess(res, data, 'Login exitoso');
});

export const meController = asyncHandler(async (req, res) => {
  const empleado = await authService.getSession(req.empleado.sub);
  sendSuccess(res, empleado, 'Sesión vigente');
});

export const verificarCodigoController = asyncHandler(async (req, res) => {
  const { codigo } = req.params;
  if (!codigo) return res.status(400).json({ success: false, message: 'Código requerido' });
  const empresa = await authService.verificarCodigo(codigo);
  sendSuccess(res, empresa, 'Código válido');
});

export const usarResetCodeController = asyncHandler(async (req, res) => {
  const { codigo, password } = req.body;
  if (!codigo || !password)
    return res.status(400).json({ success: false, message: 'Código y contraseña requeridos' });
  await authService.usarResetCode(codigo, password);
  sendSuccess(res, null, 'Contraseña actualizada. Podés iniciar sesión');
});

export const actualizarPerfilController = asyncHandler(async (req, res) => {
  const { nombre, apellido, telefono, fecha_nacimiento } = req.body;
  const data = await authService.actualizarPerfil(req.empleado.sub, { nombre, apellido, telefono, fecha_nacimiento });
  sendSuccess(res, data, 'Perfil actualizado');
});

export const cambiarPasswordController = asyncHandler(async (req, res) => {
  const { password_actual, password_nuevo } = req.body;
  if (!password_actual || !password_nuevo)
    return res.status(400).json({ success: false, message: 'Faltan campos' });
  await authService.cambiarPassword(req.empleado.sub, password_actual, password_nuevo);
  sendSuccess(res, null, 'Contraseña actualizada');
});

export const registroController = asyncHandler(async (req, res) => {
  const { codigo, nombre, apellido, email, password, telefono, fecha_nacimiento } = req.body;
  if (!codigo || !nombre || !apellido || !email || !password) {
    return res.status(400).json({ success: false, message: 'Faltan campos obligatorios' });
  }
  if (password.length < 8) {
    return res.status(400).json({ success: false, message: 'La contraseña debe tener al menos 8 caracteres' });
  }
  const data = await authService.registro({ codigo, nombre, apellido, email, password, telefono, fecha_nacimiento });
  res.status(201).json({ success: true, data, message: 'Cuenta creada exitosamente' });
});
