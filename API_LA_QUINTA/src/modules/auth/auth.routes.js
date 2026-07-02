import { Router } from 'express';
import { loginController, meController, verificarCodigoController, registroController, usarResetCodeController, cambiarPasswordController, actualizarPerfilController, actualizarPreferenciasController } from './auth.controller.js';
import { requireAuth } from '../../middlewares/auth.middleware.js';

const router = Router();
router.post('/login', loginController);
router.get('/me', requireAuth, meController);
router.get('/verificar-codigo/:codigo', verificarCodigoController);
router.post('/registro', registroController);
router.post('/usar-reset-code', usarResetCodeController);
router.post('/cambiar-password', requireAuth, cambiarPasswordController);
router.patch('/perfil', requireAuth, actualizarPerfilController);
router.patch('/preferencias', requireAuth, actualizarPreferenciasController);
export default router;
