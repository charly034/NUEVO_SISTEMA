import { Router } from 'express';
import { validate } from '../../middlewares/validation.middleware.js';
import { requireAdmin } from '../../middlewares/auth.middleware.js';
import {
  createMenuSemanalSchema,
  duplicarMenuSemanalSchema,
  updateMenuSemanalSchema,
  menuSemanalParamsSchema,
  menusSemanalesQuerySchema,
  agregarPlatoDiaSchema,
  diaOpcionParamsSchema,
  sinServicioSchema,
  sinServicioParamsSchema,
  platoIdParamsSchema,
  historialFiltrosSchema,
} from './menus-semanales.schema.js';
import {
  getMenusSemanales,
  getMenuSemanal,
  createMenuSemanal,
  updateMenuSemanal,
  deleteMenuSemanal,
  getPlatosByDia,
  agregarPlatoDia,
  quitarPlatoDia,
  marcarSinServicio,
  quitarSinServicio,
  getHistorialPorPlato,
  getPlatosUsados,
  getPlatosNoUsados,
  cambiarEstadoMenu,
  duplicarMenuSemanal,
} from './menus-semanales.controller.js';

const router = Router();
router.use(requireAdmin);

// ── Historial (van antes de /:id para no ser capturadas como parámetro) ───────
//
// Filtros disponibles como query params (todos opcionales, se combinan):
//   ?dias=30              → últimos 30 días
//   ?mes=2026-06          → junio 2026
//   ?semana=2026-W25      → semana ISO 25 del 2026
//   ?desde=2026-06-01     → desde esa fecha
//   ?hasta=2026-06-30     → hasta esa fecha
//   ?desde=...&hasta=...  → rango exacto
//   (sin filtros)         → todo el historial
//
router.get('/historial/plato/:platoId', validate({ params: platoIdParamsSchema }),                              getHistorialPorPlato);
router.get('/historial/usados',         validate({ query: historialFiltrosSchema }),                            getPlatosUsados);
router.get('/historial/no-usados',      validate({ query: historialFiltrosSchema }),                            getPlatosNoUsados);

// ── CRUD menús semanales ──────────────────────────────────────────
router.get('/',    validate({ query: menusSemanalesQuerySchema }), getMenusSemanales);
router.get('/:id', validate({ params: menuSemanalParamsSchema }), getMenuSemanal);
router.post('/',   validate({ body: createMenuSemanalSchema }),   createMenuSemanal);
router.post('/:id/duplicar', validate({ params: menuSemanalParamsSchema, body: duplicarMenuSemanalSchema }), duplicarMenuSemanal);
router.put('/:id', validate({ params: menuSemanalParamsSchema, body: updateMenuSemanalSchema }), updateMenuSemanal);
router.delete('/:id', validate({ params: menuSemanalParamsSchema }), deleteMenuSemanal);
router.patch('/:id/estado', validate({ params: menuSemanalParamsSchema }), cambiarEstadoMenu);

// ── Platos por día ────────────────────────────────────────────────
router.get('/:id/dias/:dia',
  validate({ params: sinServicioParamsSchema }),
  getPlatosByDia
);

router.post('/:id/dias',
  validate({ params: menuSemanalParamsSchema, body: agregarPlatoDiaSchema }),
  agregarPlatoDia
);

router.delete('/:id/dias/:dia/:opcion',
  validate({ params: diaOpcionParamsSchema }),
  quitarPlatoDia
);

// ── Días sin servicio ─────────────────────────────────────────────
router.post('/:id/sin-servicio',
  validate({ params: menuSemanalParamsSchema, body: sinServicioSchema }),
  marcarSinServicio
);

router.delete('/:id/sin-servicio/:dia',
  validate({ params: sinServicioParamsSchema }),
  quitarSinServicio
);

export default router;
