import { Router } from 'express';
import { getEmpleados, getEmpleado, createEmpleado, updateEmpleado, deleteEmpleado, generarResetCode } from './empleados.controller.js';
import { requireAdmin, requireSuperAdmin } from '../../middlewares/auth.middleware.js';

const router = Router();
router.use(requireAdmin);
router.get('/', getEmpleados);
router.get('/:id', getEmpleado);
router.post('/', createEmpleado);
router.patch('/:id', updateEmpleado);
router.delete('/:id', requireSuperAdmin, deleteEmpleado);
router.post('/:id/reset-code', generarResetCode);
export default router;
