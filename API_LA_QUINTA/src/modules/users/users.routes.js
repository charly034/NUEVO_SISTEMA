import { Router } from 'express';
import { requireAdmin } from '../../middlewares/auth.middleware.js';

const router = Router();

router.use(requireAdmin);

const usersLegacyGone = (req, res) => {
  res.status(410).json({
    success: false,
    message: 'El modulo legacy /users fue retirado. Usar /empleados o /admin/auth/usuarios segun corresponda.',
    errors: [],
  });
};

router.all('/', usersLegacyGone);
router.all('/:id', usersLegacyGone);

export default router;
