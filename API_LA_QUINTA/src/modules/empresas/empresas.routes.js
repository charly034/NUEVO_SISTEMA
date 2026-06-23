import { Router } from 'express';
import { getEmpresas, getEmpresa, createEmpresa, updateEmpresa, deleteEmpresa, reabrirPlazo, cerrarOverride } from './empresas.controller.js';
import { requireAdmin } from '../../middlewares/auth.middleware.js';

const router = Router();
router.use(requireAdmin);
router.get('/', getEmpresas);
router.get('/:id', getEmpresa);
router.post('/', createEmpresa);
router.patch('/:id', updateEmpresa);
router.delete('/:id', deleteEmpresa);
router.post('/:id/reabrir-plazo', reabrirPlazo);
router.delete('/:id/reabrir-plazo', cerrarOverride);
export default router;
