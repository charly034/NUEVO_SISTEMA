import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendCreated, sendSuccess } from '../../utils/response.js';
import * as service from './finanzas.service.js';

export const getResumen = asyncHandler(async (req, res) => {
  sendSuccess(res, await service.getResumen(), 'Resumen financiero obtenido');
});

export const getPedidosPagos = asyncHandler(async (req, res) => {
  sendSuccess(res, await service.getPedidosPagos(req.query), 'Pedidos y pagos obtenidos');
});

export const getCuentaCorrienteEmpresa = asyncHandler(async (req, res) => {
  sendSuccess(
    res,
    await service.getCuentaCorriente('empresa', req.params.empresaId),
    'Cuenta corriente de empresa obtenida',
  );
});

export const getCuentaCorrienteEmpleado = asyncHandler(async (req, res) => {
  sendSuccess(
    res,
    await service.getCuentaCorriente('empleado', req.params.empleadoId),
    'Cuenta corriente de empleado obtenida',
  );
});

export const getMiHistorial = asyncHandler(async (req, res) => {
  sendSuccess(
    res,
    await service.getMiHistorialFinanciero(req.empleado),
    'Historial financiero obtenido',
  );
});

export const crearPago = asyncHandler(async (req, res) => {
  sendCreated(res, await service.crearPago(req.body, req.adminUser), 'Pago registrado');
});

export const actualizarPago = asyncHandler(async (req, res) => {
  sendSuccess(res, await service.actualizarPago(req.params.id, req.body, req.adminUser), 'Pago actualizado');
});

export const anularPago = asyncHandler(async (req, res) => {
  sendSuccess(res, await service.anularPago(req.params.id, req.body, req.adminUser), 'Pago anulado');
});

export const aplicarPago = asyncHandler(async (req, res) => {
  sendSuccess(res, await service.aplicarPago(req.params.id, req.body, req.adminUser), 'Pago aplicado');
});

export const desasociarAplicacion = asyncHandler(async (req, res) => {
  sendSuccess(
    res,
    await service.desasociarAplicacion(req.params.id, req.params.aplicacionId, req.adminUser),
    'Aplicacion de pago desasociada',
  );
});

export const crearAjuste = asyncHandler(async (req, res) => {
  sendCreated(res, await service.crearAjuste(req.body, req.adminUser), 'Ajuste financiero registrado');
});
