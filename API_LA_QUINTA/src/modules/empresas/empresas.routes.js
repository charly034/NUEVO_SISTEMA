import { Router } from 'express';
import { getEmpresas, getEmpresa, createEmpresa, updateEmpresa, deleteEmpresa, reabrirPlazo, cerrarOverride, regenerarCodigo } from './empresas.controller.js';
import { requireAdmin, requireSuperAdmin } from '../../middlewares/auth.middleware.js';

const router = Router();
router.use(requireAdmin);
router.get('/', getEmpresas);
router.get('/:id', getEmpresa);
router.post('/', createEmpresa);
router.patch('/:id', updateEmpresa);
router.delete('/:id', requireSuperAdmin, deleteEmpresa);
router.post('/:id/reabrir-plazo', reabrirPlazo);
router.delete('/:id/reabrir-plazo', cerrarOverride);
router.post('/:id/regenerar-codigo', requireSuperAdmin, regenerarCodigo);
export default router;
