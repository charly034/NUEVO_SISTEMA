import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiError } from '../../utils/ApiError.js';
import * as service from './notificaciones.service.js';

export const listar = asyncHandler(async (req, res) => {
  const notifs = await service.listarEmpleado(req.empleado.id);
  res.json({ data: notifs });
});

export const contarNoLeidas = asyncHandler(async (req, res) => {
  const count = await service.contarNoLeidas(req.empleado.id);
  res.json({ data: { count } });
});

export const marcarLeida = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  if (!id) throw new ApiError(400, 'ID invalido');
  await service.marcarLeida(id, req.empleado.id);
  res.json({ data: { id } });
});

export const marcarTodasLeidas = asyncHandler(async (req, res) => {
  const actualizadas = await service.marcarTodasLeidas(req.empleado.id);
  res.json({ data: { actualizadas } });
});

export const listarAdmin = asyncHandler(async (req, res) => {
  const notificaciones = await service.listarAdmin(req.query);
  res.json({ data: notificaciones });
});

export const enviarAdmin = asyncHandler(async (req, res) => {
  const resultado = await service.enviarDesdeAdmin(req.body);
  res.status(201).json({
    success: true,
    message: resultado.enviadas > 0 ? 'Notificaciones enviadas' : 'No hubo destinatarios activos',
    data: resultado,
  });
});

export const listarReglas = asyncHandler(async (req, res) => {
  const reglas = await service.listarReglas(req.query);
  res.json({ data: reglas });
});

export const crearRegla = asyncHandler(async (req, res) => {
  const regla = await service.crearRegla(req.body);
  res.status(201).json({ success: true, message: 'Regla creada', data: regla });
});

export const actualizarRegla = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  if (!id) throw new ApiError(400, 'ID invalido');
  const regla = await service.actualizarRegla(id, req.body);
  res.json({ success: true, message: 'Regla actualizada', data: regla });
});

export const eliminarRegla = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  if (!id) throw new ApiError(400, 'ID invalido');
  await service.eliminarRegla(id);
  res.status(204).send();
});

export const getConfigWhatsapp = asyncHandler(async (_req, res) => {
  const config = await service.getConfigWhatsapp();
  res.json({ data: config });
});

export const actualizarConfigWhatsapp = asyncHandler(async (req, res) => {
  const config = await service.actualizarConfigWhatsapp(req.body);
  res.json({ success: true, message: 'Configuracion de WhatsApp actualizada', data: config });
});

export const listarDestinatariosWhatsapp = asyncHandler(async (_req, res) => {
  const destinatarios = await service.listarDestinatariosWhatsapp();
  res.json({ data: destinatarios });
});

export const crearDestinatarioWhatsapp = asyncHandler(async (req, res) => {
  const destinatario = await service.crearDestinatarioWhatsapp(req.body);
  res.status(201).json({ success: true, message: 'Destinatario creado', data: destinatario });
});

export const actualizarDestinatarioWhatsapp = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  if (!id) throw new ApiError(400, 'ID invalido');
  const destinatario = await service.actualizarDestinatarioWhatsapp(id, req.body);
  res.json({ success: true, message: 'Destinatario actualizado', data: destinatario });
});

export const eliminarDestinatarioWhatsapp = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  if (!id) throw new ApiError(400, 'ID invalido');
  await service.eliminarDestinatarioWhatsapp(id);
  res.status(204).send();
});

export const listarEnviosWhatsapp = asyncHandler(async (req, res) => {
  const envios = await service.listarEnviosWhatsapp(req.query);
  res.json({ data: envios });
});

export const probarWebhookWhatsapp = asyncHandler(async (req, res) => {
  const resultado = await service.probarWebhookWhatsapp(req.body);
  res.status(resultado.enviado ? 201 : 502).json({
    success: resultado.enviado,
    message: resultado.enviado ? 'Webhook probado correctamente' : 'El webhook respondio con error',
    data: resultado,
  });
});
