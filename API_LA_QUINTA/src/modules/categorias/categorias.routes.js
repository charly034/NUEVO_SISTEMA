import { Router } from 'express';
import { validate } from '../../middlewares/validation.middleware.js';
import { requireAdmin } from '../../middlewares/auth.middleware.js';
import {
  idParamsSchema, grupoParamsSchema, grupoPlatoParamsSchema,
  listQuerySchema, crearCategoriaSchema, actualizarCategoriaSchema, duplicarCategoriaSchema,
  crearGrupoSchema, actualizarGrupoSchema, platoDeGrupoSchema, gruposActivosQuerySchema,
  resembrarRotacionSchema, forzarGrupoSemanaSchema, quitarForzadoSemanaSchema,
} from './categorias.schema.js';
import {
  getCategorias, getCategoria, postCategoria, patchCategoria, deleteCategoria, postDuplicarCategoria,
  postGrupo, patchGrupo, deleteGrupo, postPlatoDeGrupo, deletePlatoDeGrupo, getGruposActivos,
  postResembrarRotacion, putForzarGrupo, deleteForzarGrupo,
} from './categorias.controller.js';

const router = Router();
router.use(requireAdmin);

// ── Categorías ──────────────────────────────────────────────────────────
router.get('/', validate({ query: listQuerySchema }), getCategorias);
router.post('/', validate({ body: crearCategoriaSchema }), postCategoria);
router.get('/:id', validate({ params: idParamsSchema }), getCategoria);
router.patch('/:id', validate({ params: idParamsSchema, body: actualizarCategoriaSchema }), patchCategoria);
router.delete('/:id', validate({ params: idParamsSchema }), deleteCategoria);
router.post('/:id/duplicar', validate({ params: idParamsSchema, body: duplicarCategoriaSchema }), postDuplicarCategoria);

// ── Grupos de rotación de la categoría ─────────────────────────────────
router.get('/:id/grupos-activos', validate({ params: idParamsSchema, query: gruposActivosQuerySchema }), getGruposActivos);
router.post('/:id/rotacion/resembrar', validate({ params: idParamsSchema, body: resembrarRotacionSchema }), postResembrarRotacion);
router.put('/:id/rotacion/forzar', validate({ params: idParamsSchema, body: forzarGrupoSemanaSchema }), putForzarGrupo);
router.delete('/:id/rotacion/forzar', validate({ params: idParamsSchema, body: quitarForzadoSemanaSchema }), deleteForzarGrupo);
router.post('/:id/grupos', validate({ params: idParamsSchema, body: crearGrupoSchema }), postGrupo);
router.patch('/:id/grupos/:grupoId', validate({ params: grupoParamsSchema, body: actualizarGrupoSchema }), patchGrupo);
router.delete('/:id/grupos/:grupoId', validate({ params: grupoParamsSchema }), deleteGrupo);
router.post('/:id/grupos/:grupoId/platos', validate({ params: grupoParamsSchema, body: platoDeGrupoSchema }), postPlatoDeGrupo);
router.delete('/:id/grupos/:grupoId/platos/:platoId', validate({ params: grupoPlatoParamsSchema }), deletePlatoDeGrupo);

export default router;
