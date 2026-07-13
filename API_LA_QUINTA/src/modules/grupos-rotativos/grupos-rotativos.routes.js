import { Router } from 'express';
import { validate } from '../../middlewares/validation.middleware.js';
import { requireAdmin } from '../../middlewares/auth.middleware.js';
import {
  idParamsSchema, cicloParamsSchema, grupoParamsSchema, grupoPlatoParamsSchema,
  cicloQuerySchema, crearCicloSchema, actualizarCicloSchema,
  crearGrupoSchema, actualizarGrupoSchema, platoDeGrupoSchema,
  forzarSeleccionSemanaSchema, seleccionSemanaQuerySchema,
} from './grupos-rotativos.schema.js';
import {
  getCiclos, getCicloDetalle, postCiclo, patchCiclo,
  postGrupo, patchGrupo, postPlatoDeGrupo, deletePlatoDeGrupo,
  postSeleccionSemana, deleteSeleccionSemana,
} from './grupos-rotativos.controller.js';

const router = Router();
router.use(requireAdmin);

router.get('/ciclos', validate({ query: cicloQuerySchema }), getCiclos);
router.post('/ciclos', validate({ body: crearCicloSchema }), postCiclo);
router.get('/ciclos/:id', validate({ params: idParamsSchema }), getCicloDetalle);
router.patch('/ciclos/:id', validate({ params: idParamsSchema, body: actualizarCicloSchema }), patchCiclo);

router.post('/grupos', validate({ body: crearGrupoSchema }), postGrupo);
router.patch('/grupos/:id', validate({ params: idParamsSchema, body: actualizarGrupoSchema }), patchGrupo);
router.post('/grupos/:grupoId/platos', validate({ params: grupoParamsSchema, body: platoDeGrupoSchema }), postPlatoDeGrupo);
router.delete('/grupos/:grupoId/platos/:platoId', validate({ params: grupoPlatoParamsSchema }), deletePlatoDeGrupo);

router.post('/seleccion-semana', validate({ body: forzarSeleccionSemanaSchema }), postSeleccionSemana);
router.delete('/ciclos/:cicloId/seleccion-semana', validate({ params: cicloParamsSchema, query: seleccionSemanaQuerySchema }), deleteSeleccionSemana);

export default router;
