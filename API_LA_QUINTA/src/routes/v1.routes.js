import { Router } from 'express';
import healthRoutes from '../modules/health/health.routes.js';
import usersRoutes from '../modules/users/users.routes.js';
import platosRoutes from '../modules/platos/platos.routes.js';
import menusSemanalesRoutes from '../modules/menus-semanales/menus-semanales.routes.js';
import estadisticasRoutes from '../modules/estadisticas/estadisticas.routes.js';
import sugerenciasRoutes from '../modules/sugerencias/sugerencias.routes.js';
import pedidosRoutes from '../modules/pedidos/pedidos.routes.js';
import authRoutes from '../modules/auth/auth.routes.js';
import adminAuthRoutes from '../modules/admin-auth/admin-auth.routes.js';
import guarnicionesRoutes from '../modules/guarniciones/guarniciones.routes.js';
import empresasRoutes from '../modules/empresas/empresas.routes.js';
import empleadosRoutes from '../modules/empleados/empleados.routes.js';
import menuRoutes from '../modules/menu/menu.routes.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/admin/auth', adminAuthRoutes);
router.use('/users', usersRoutes);
router.use('/platos', platosRoutes);
router.use('/menus-semanales', menusSemanalesRoutes);
router.use('/estadisticas', estadisticasRoutes);
router.use('/sugerencias', sugerenciasRoutes);
router.use('/pedidos', pedidosRoutes);
router.use('/menu', menuRoutes);
router.use('/guarniciones', guarnicionesRoutes);
router.use('/empresas', empresasRoutes);
router.use('/empleados', empleadosRoutes);

export default router;
