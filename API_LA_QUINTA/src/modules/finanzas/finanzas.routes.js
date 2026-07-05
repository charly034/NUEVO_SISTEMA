import { Router } from 'express';
import { requireAdminAuth, requireAuth } from '../../middlewares/auth.middleware.js';
import * as ctrl from './finanzas.controller.js';

const router = Router();

router.get('/mi-historial', requireAuth, ctrl.getMiHistorial);

router.use(requireAdminAuth);

router.get('/resumen', ctrl.getResumen);
router.get('/pedidos-pagos', ctrl.getPedidosPagos);
router.get('/cuenta-corriente/empresas/:empresaId', ctrl.getCuentaCorrienteEmpresa);
router.get('/cuenta-corriente/empleados/:empleadoId', ctrl.getCuentaCorrienteEmpleado);
router.post('/pagos', ctrl.crearPago);
router.patch('/pagos/:id', ctrl.actualizarPago);
router.post('/pagos/:id/anular', ctrl.anularPago);
router.post('/pagos/:id/aplicar', ctrl.aplicarPago);
router.delete('/pagos/:id/aplicaciones/:aplicacionId', ctrl.desasociarAplicacion);
router.post('/ajustes', ctrl.crearAjuste);

export default router;
