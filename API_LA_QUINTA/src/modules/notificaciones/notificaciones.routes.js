import { Router } from 'express';
import { requireAdmin, requireAuth } from '../../middlewares/auth.middleware.js';
import * as ctrl from './notificaciones.controller.js';

const router = Router();

router.get('/admin', requireAdmin, ctrl.listarAdmin);
router.post('/admin', requireAdmin, ctrl.enviarAdmin);
router.get('/admin/reglas', requireAdmin, ctrl.listarReglas);
router.post('/admin/reglas', requireAdmin, ctrl.crearRegla);
router.patch('/admin/reglas/:id', requireAdmin, ctrl.actualizarRegla);
router.delete('/admin/reglas/:id', requireAdmin, ctrl.eliminarRegla);
router.get('/admin/whatsapp/config', requireAdmin, ctrl.getConfigWhatsapp);
router.get('/admin/whatsapp/config/reveal', requireAdmin, ctrl.revelarConfigWhatsapp);
router.patch('/admin/whatsapp/config', requireAdmin, ctrl.actualizarConfigWhatsapp);
router.get('/admin/whatsapp/destinatarios', requireAdmin, ctrl.listarDestinatariosWhatsapp);
router.post('/admin/whatsapp/destinatarios', requireAdmin, ctrl.crearDestinatarioWhatsapp);
router.patch('/admin/whatsapp/destinatarios/:id', requireAdmin, ctrl.actualizarDestinatarioWhatsapp);
router.delete('/admin/whatsapp/destinatarios/:id', requireAdmin, ctrl.eliminarDestinatarioWhatsapp);
router.get('/admin/whatsapp/envios', requireAdmin, ctrl.listarEnviosWhatsapp);
router.get('/admin/whatsapp/test-logs', requireAdmin, ctrl.listarWhatsappTestLogs);
router.post('/admin/whatsapp/probar', requireAdmin, ctrl.probarWebhookWhatsapp);

router.use(requireAuth);

router.get('/',                   ctrl.listar);
router.get('/no-leidas/count',    ctrl.contarNoLeidas);
router.patch('/leer-todas',       ctrl.marcarTodasLeidas);
router.patch('/:id/leer',         ctrl.marcarLeida);

export default router;
