import { Router } from 'express';
import { requireAdmin } from '../../middlewares/auth.middleware.js';
import { getPlanes, createPlan, updatePlan, deletePlan } from './planes.controller.js';

const router = Router();

router.use(requireAdmin);
router.get('/', getPlanes);
router.post('/', createPlan);
router.patch('/:id', updatePlan);
router.delete('/:id', deletePlan);

export default router;
