import { Router } from 'express';
import { loginController, meController } from './auth.controller.js';
import { requireAuth } from '../../middlewares/auth.middleware.js';

const router = Router();
router.post('/login', loginController);
router.get('/me', requireAuth, meController);
export default router;
