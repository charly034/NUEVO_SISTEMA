import { Router } from 'express';
import { getEmpleados, getEmpleado, createEmpleado, updateEmpleado, deleteEmpleado } from './empleados.controller.js';
import { requireAdmin } from '../../middlewares/auth.middleware.js';

const router = Router();
router.use(requireAdmin);
router.get('/', getEmpleados);
router.get('/:id', getEmpleado);
router.post('/', createEmpleado);
router.patch('/:id', updateEmpleado);
router.delete('/:id', deleteEmpleado);
export default router;
